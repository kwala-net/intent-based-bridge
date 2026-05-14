// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IntentEscrow} from "../src/IntentEscrow.sol";

/**
 * @notice Deploy IntentEscrow only. MockUSDC is already deployed on both chains —
 *         keep the existing addresses in .env.
 *
 * After running, copy the printed address into .env:
 *   NEXT_PUBLIC_INTENT_ESCROW_<NETWORK>=<address>
 *
 * Then run: npm run gen-abis
 */
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        IntentEscrow escrow = new IntentEscrow(msg.sender);
        vm.stopBroadcast();

        console2.log("INTENT_ESCROW=%s", address(escrow));
        console2.log("CHAIN_ID=%s",      block.chainid);
    }
}
