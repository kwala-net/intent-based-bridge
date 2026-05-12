// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Testnet-only ERC20. 18 decimals (not 6) to keep maths uniform with
 *         IntentEscrow assumptions. Anyone can mint — no production use.
 */
contract MockUSDC is ERC20 {
    mapping(address => uint256) public lastFaucet;

    constructor() ERC20("Mock USDC", "mUSDC") {}

    /// @notice Permissionless mint — testnet only.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Self-service faucet: 10,000 mUSDC once per day per address.
    function faucet() external {
        require(block.timestamp >= lastFaucet[msg.sender] + 1 days, "faucet: once per day");
        lastFaucet[msg.sender] = block.timestamp;
        _mint(msg.sender, 10_000 * 1e18);
    }
}
