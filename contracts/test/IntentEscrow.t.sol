// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IntentEscrow} from "../src/IntentEscrow.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract IntentEscrowTest is Test {
    IntentEscrow escrow;
    MockUSDC     token;

    address user      = makeAddr("user");
    address relayer   = makeAddr("relayer");
    address recipient = makeAddr("recipient");

    uint256 constant INPUT_AMOUNT  = 1_000 * 1e18;
    uint256 constant OUTPUT_AMOUNT = 998  * 1e18;
    uint256 constant DST_CHAIN     = 43113;

    function setUp() public {
        escrow = new IntentEscrow(address(this));
        token  = new MockUSDC();

        token.mint(user,    INPUT_AMOUNT  * 10);
        token.mint(relayer, OUTPUT_AMOUNT * 10);

        vm.prank(user);
        token.approve(address(escrow), type(uint256).max);

        vm.prank(relayer);
        token.approve(address(escrow), type(uint256).max);
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    function _createIntent() internal returns (bytes32) {
        vm.prank(user);
        return escrow.createIntent(
            address(token),
            INPUT_AMOUNT,
            DST_CHAIN,
            address(token),
            OUTPUT_AMOUNT,
            recipient,
            uint32(block.timestamp + 300)
        );
    }

    // ── tests ──────────────────────────────────────────────────────────────────

    function test_createAndFill() public {
        bytes32 intentId = _createIntent();

        assertEq(token.balanceOf(address(escrow)), INPUT_AMOUNT);

        uint256 before = token.balanceOf(recipient);
        vm.prank(relayer);
        escrow.fillIntent(intentId, block.chainid, recipient, address(token), OUTPUT_AMOUNT);

        assertEq(token.balanceOf(recipient), before + OUTPUT_AMOUNT);
        assertTrue(escrow.filled(intentId));
    }

    function test_doubleFillReverts() public {
        bytes32 intentId = _createIntent();

        vm.prank(relayer);
        escrow.fillIntent(intentId, block.chainid, recipient, address(token), OUTPUT_AMOUNT);

        vm.prank(relayer);
        vm.expectRevert("already filled");
        escrow.fillIntent(intentId, block.chainid, recipient, address(token), OUTPUT_AMOUNT);
    }

    function test_reclaimAfterDeadline() public {
        uint32 deadline = uint32(block.timestamp + 300);
        vm.prank(user);
        bytes32 intentId = escrow.createIntent(
            address(token), INPUT_AMOUNT, DST_CHAIN, address(token), OUTPUT_AMOUNT, recipient, deadline
        );

        vm.warp(deadline + 1);

        uint256 before = token.balanceOf(user);
        vm.prank(user);
        escrow.reclaim(intentId);

        assertEq(token.balanceOf(user), before + INPUT_AMOUNT);
        assertTrue(escrow.intents(intentId).reclaimed);
    }

    function test_reclaimBeforeDeadlineReverts() public {
        bytes32 intentId = _createIntent();

        vm.prank(user);
        vm.expectRevert("deadline not passed");
        escrow.reclaim(intentId);
    }

    // Documents the "missing settlement" gap: reclaim is purely deadline-gated.
    // The origin chain cannot verify whether the intent was filled on the destination.
    // A user can reclaim even after a successful remote fill, stealing from the relayer.
    // Post-MVP: close this with a cross-chain settlement / Merkle proof.
    function test_reclaimIsDeadlineGatedOnly_noKnowledgeOfRemoteFill() public {
        uint32 deadline = uint32(block.timestamp + 300);
        vm.prank(user);
        bytes32 intentId = escrow.createIntent(
            address(token), INPUT_AMOUNT, DST_CHAIN, address(token), OUTPUT_AMOUNT, recipient, deadline
        );

        // In production, fill happens on the destination chain and the origin
        // contract is never informed. We just warp past the deadline here.
        vm.warp(deadline + 1);

        vm.prank(user);
        escrow.reclaim(intentId); // succeeds — deadline only check

        assertEq(token.balanceOf(user), INPUT_AMOUNT * 10);
    }

    function test_doubleReclaimReverts() public {
        uint32 deadline = uint32(block.timestamp + 300);
        vm.prank(user);
        bytes32 intentId = escrow.createIntent(
            address(token), INPUT_AMOUNT, DST_CHAIN, address(token), OUTPUT_AMOUNT, recipient, deadline
        );

        vm.warp(deadline + 1);
        vm.prank(user);
        escrow.reclaim(intentId);

        vm.prank(user);
        vm.expectRevert("already reclaimed");
        escrow.reclaim(intentId);
    }
}
