// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC}     from "../src/MockUSDC.sol";
import {IntentEscrow} from "../src/IntentEscrow.sol";

/**
 * @notice Deploy MockUSDC + IntentEscrow and seed the deployer with 1M mUSDC.
 *
 * After running, copy the printed addresses into .env:
 *   NEXT_PUBLIC_MOCK_USDC_<NETWORK>=<address>
 *   NEXT_PUBLIC_INTENT_ESCROW_<NETWORK>=<address>
 *
 * Then run: pnpm gen-abis
 */
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        MockUSDC mockUsdc     = new MockUSDC();
        IntentEscrow escrow   = new IntentEscrow(deployer);

        mockUsdc.mint(deployer, 1_000_000 * 1e18);

        vm.stopBroadcast();

        // Parseable output — copy these into .env
        console2.log("MOCK_USDC=%s",     address(mockUsdc));
        console2.log("INTENT_ESCROW=%s", address(escrow));
        console2.log("CHAIN_ID=%s",      block.chainid);
    }
}
