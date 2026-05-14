-include ../.env

.PHONY: install build test deploy-sepolia deploy-fuji manual-fill

install:
	forge install OpenZeppelin/openzeppelin-contracts@v5.0.1
	forge install foundry-rs/forge-std

build:
	forge build

test:
	forge test -vvv

deploy-sepolia:
	forge script script/Deploy.s.sol:Deploy \
		--rpc-url $(SEPOLIA_RPC_URL) \
		--private-key $(DEPLOYER_PRIVATE_KEY) \
		--broadcast \
		-vvvv

deploy-fuji:
	forge script script/Deploy.s.sol:Deploy \
		--rpc-url $(FUJI_RPC_URL) \
		--private-key $(DEPLOYER_PRIVATE_KEY) \
		--broadcast \
		-vvvv

# Fill an intent manually (simulates the relayer before Kwala is wired up).
# Prerequisites: the INVENTORY wallet must hold outputToken on the destination
# chain and must have approved the IntentEscrow contract to spend it. The caller
# (DEPLOYER_PRIVATE_KEY here) does not need to hold or approve anything.
#
# Usage:
#   make manual-fill \
#     CHAIN=fuji \
#     INTENT_ID=0x... \
#     ORIGIN_CHAIN_ID=11155111 \
#     RECIPIENT=0x... \
#     OUTPUT_TOKEN=0x... \
#     OUTPUT_AMOUNT=998000000000000000 \
#     INVENTORY=0x...
manual-fill:
	@if [ "$(CHAIN)" = "fuji" ]; then \
		cast send $(NEXT_PUBLIC_INTENT_ESCROW_FUJI) \
			"fillIntent(bytes32,uint256,address,address,uint256,address)" \
			$(INTENT_ID) $(ORIGIN_CHAIN_ID) $(RECIPIENT) $(OUTPUT_TOKEN) $(OUTPUT_AMOUNT) $(INVENTORY) \
			--rpc-url $(FUJI_RPC_URL) \
			--private-key $(DEPLOYER_PRIVATE_KEY); \
	elif [ "$(CHAIN)" = "sepolia" ]; then \
		cast send $(NEXT_PUBLIC_INTENT_ESCROW_SEPOLIA) \
			"fillIntent(bytes32,uint256,address,address,uint256,address)" \
			$(INTENT_ID) $(ORIGIN_CHAIN_ID) $(RECIPIENT) $(OUTPUT_TOKEN) $(OUTPUT_AMOUNT) $(INVENTORY) \
			--rpc-url $(SEPOLIA_RPC_URL) \
			--private-key $(DEPLOYER_PRIVATE_KEY); \
	else \
		echo "Error: CHAIN must be 'fuji' or 'sepolia'"; exit 1; \
	fi
