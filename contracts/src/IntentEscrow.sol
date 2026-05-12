// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IntentEscrow
 * @notice Deployed identically on every supported chain. Acts as the deposit
 *         vault on the origin chain and the fill target on the destination chain.
 *
 * Fast-flow only — no settlement, no canonical bridge integration. A single
 * trusted relayer (driven by Kwala workflows) observes IntentCreated events and
 * calls fillIntent on the destination. Funds escrowed for filled intents are
 * only recoverable via ownerWithdraw until a settlement layer is added.
 */
contract IntentEscrow is Ownable {
    using SafeERC20 for IERC20;

    struct Intent {
        address user;
        address inputToken;
        uint256 inputAmount;
        uint256 dstChainId;
        address outputToken;
        uint256 outputAmount;
        address recipient;
        uint32  fillDeadline;
        bool    reclaimed;
    }

    /// @notice Destination-side: prevents double-fills.
    mapping(bytes32 => bool) public filled;

    /// @notice Origin-side: stores intents for reclaim eligibility.
    mapping(bytes32 => Intent) public intents;

    /// @notice Per-user nonces — incremented on every createIntent call.
    mapping(address => uint256) public nonces;

    // ── Events ────────────────────────────────────────────────────────────────

    /**
     * @notice Emitted on the origin chain when a user deposits and registers an intent.
     * @dev All params are present so Kwala Workflow A can construct the fillIntent call
     *      purely from this event without any additional RPC reads.
     */
    event IntentCreated(
        bytes32 indexed intentId,
        address indexed user,
        address inputToken,
        uint256 inputAmount,
        uint256 dstChainId,
        address outputToken,
        uint256 outputAmount,
        address recipient,
        uint32  fillDeadline,
        uint256 nonce
    );

    /**
     * @notice Emitted on the destination chain when a relayer fills an intent.
     * @dev All params required by the backend webhook are covered here.
     *      Kwala Workflow B reads this event and POSTs to /api/webhooks/fill.
     *      txHash and chainId are injected by Kwala from transaction context.
     */
    event IntentFilled(
        bytes32 indexed intentId,
        uint256 indexed originChainId,
        address indexed relayer,
        address recipient,
        address outputToken,
        uint256 outputAmount
    );

    /// @notice Emitted on the origin chain when a user reclaims expired escrow.
    event IntentReclaimed(bytes32 indexed intentId, address indexed user);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address owner_) Ownable(owner_) {}

    // ── Origin-chain functions ────────────────────────────────────────────────

    /**
     * @notice Deposit inputToken and register a cross-chain intent.
     * @return intentId Deterministic ID derived from chain + sender + nonce + params.
     */
    function createIntent(
        address inputToken,
        uint256 inputAmount,
        uint256 dstChainId,
        address outputToken,
        uint256 outputAmount,
        address recipient,
        uint32  fillDeadline
    ) external returns (bytes32 intentId) {
        uint256 nonce = nonces[msg.sender]++;

        intentId = keccak256(abi.encode(
            block.chainid,
            msg.sender,
            nonce,
            inputToken,
            inputAmount,
            dstChainId,
            outputToken,
            outputAmount,
            recipient,
            fillDeadline
        ));

        intents[intentId] = Intent({
            user:         msg.sender,
            inputToken:   inputToken,
            inputAmount:  inputAmount,
            dstChainId:   dstChainId,
            outputToken:  outputToken,
            outputAmount: outputAmount,
            recipient:    recipient,
            fillDeadline: fillDeadline,
            reclaimed:    false
        });

        IERC20(inputToken).safeTransferFrom(msg.sender, address(this), inputAmount);

        emit IntentCreated(
            intentId,
            msg.sender,
            inputToken,
            inputAmount,
            dstChainId,
            outputToken,
            outputAmount,
            recipient,
            fillDeadline,
            nonce
        );
    }

    /**
     * @notice Reclaim escrowed funds after fillDeadline has passed.
     *
     * IMPORTANT: This check is purely deadline-gated. The origin chain has no
     * knowledge of whether the intent was filled on the destination chain because
     * there is no cross-chain messaging in this MVP. A user could theoretically
     * reclaim funds even after a successful fill on the destination, effectively
     * stealing from the relayer's inventory. This is acceptable for the MVP but
     * MUST be closed by a settlement/proof layer before mainnet.
     */
    function reclaim(bytes32 intentId) external {
        Intent storage intent = intents[intentId];
        require(intent.user == msg.sender,           "not your intent");
        require(block.timestamp > intent.fillDeadline, "deadline not passed");
        require(!intent.reclaimed,                   "already reclaimed");

        intent.reclaimed = true;
        IERC20(intent.inputToken).safeTransfer(msg.sender, intent.inputAmount);

        emit IntentReclaimed(intentId, msg.sender);
    }

    // ── Destination-chain functions ───────────────────────────────────────────

    /**
     * @notice Pull outputToken from the relayer and deliver to recipient.
     * @dev Relayer must approve this contract before calling.
     */
    function fillIntent(
        bytes32 intentId,
        uint256 originChainId,
        address recipient,
        address outputToken,
        uint256 outputAmount
    ) external {
        require(!filled[intentId], "already filled");
        filled[intentId] = true;

        IERC20(outputToken).safeTransferFrom(msg.sender, recipient, outputAmount);

        emit IntentFilled(intentId, originChainId, msg.sender, recipient, outputToken, outputAmount);
    }

    // ── Owner functions ───────────────────────────────────────────────────────

    /**
     * @notice Emergency withdrawal for stuck funds.
     *
     * CENTRALISATION RISK: The owner can drain any token from this contract.
     * This exists only because there is no settlement layer — filled intents'
     * escrowed deposits have no other recovery path in the MVP. Post-MVP this
     * function should be removed or gated behind a timelock + settlement proof.
     */
    function ownerWithdraw(address token, uint256 amount, address to) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
}
