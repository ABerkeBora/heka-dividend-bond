// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {DividendBond} from "../contracts/DividendBond.sol";
import {TestDividendUSD} from "../contracts/TestDividendUSD.sol";
import {AirnodeV2Attestation} from "../contracts/vendor/AirnodeV2Attestation.sol";
import {IsoTimestamp} from "../contracts/vendor/IsoTimestamp.sol";

/// @notice Real EODHD proofs captured from the live Airnode; deterministic clock makes evidence reproducible.
contract RealEodhdProofTest is Test {
    address private constant EODHD = 0xDaF9D3493e556e9f25b34A3c366795F81e90c6fe;
    bytes32 private constant EXPECTED_REQUEST = 0x126a0237bcd5538d8833c4ed4605d2e5be13b37157c3de50a32ed8e0b43ec299;
    address private constant BENEFICIARY = address(0xB0B);
    address private constant KEEPER = address(0xCAFE);

    struct Proof {
        uint256 timestamp;
        bytes data;
        bytes signature;
        bytes32 requestHash;
    }

    TestDividendUSD private token;
    DividendBond private bond;
    Proof private realProof;

    function _load(string memory file) private view returns (Proof memory proof) {
        string memory json = vm.readFile(file);
        proof.timestamp = vm.parseUint(vm.parseJsonString(json, ".timestamp"));
        proof.data = bytes(vm.parseJsonString(json, ".data"));
        proof.signature = vm.parseJsonBytes(json, ".signature");
        proof.requestHash = vm.parseJsonBytes32(json, ".requestHash");
    }

    function setUp() public {
        realProof = _load("test/fixtures/real-eodhd-dividend.json");
        vm.warp(realProof.timestamp);
        token = new TestDividendUSD(address(this), 1_000e6);
        bond = new DividendBond(
            DividendBond.Terms({
                asset: address(token),
                beneficiary: BENEFICIARY,
                airnode: EODHD,
                requestHash: EXPECTED_REQUEST,
                ticker: "AAPL.US",
                eventDate: IsoTimestamp.parse("2025-08-11"),
                paymentDate: IsoTimestamp.parse("2025-08-14"),
                quantityE18: 100e18,
                payoutCap: 50e6,
                earliestSettlement: IsoTimestamp.parse("2025-08-14"),
                claimDeadline: block.timestamp + 24 hours,
                voidGrace: 1 hours
            })
        );
        token.approve(address(bond), 50e6);
        bond.fund();
    }

    function _reject(Proof memory proof) private returns (bytes memory errorData) {
        uint256 issuerBefore = token.balanceOf(address(this));
        uint256 reserveBefore = token.balanceOf(address(bond));
        uint256 beneficiaryBefore = token.balanceOf(BENEFICIARY);
        (bool success, bytes memory reason) =
            address(bond).call(abi.encodeCall(DividendBond.claimFor, (proof.timestamp, proof.data, proof.signature)));
        assertFalse(success, "forged/unusable proof triggered payout");
        assertEq(token.balanceOf(address(this)), issuerBefore, "issuer balance changed");
        assertEq(token.balanceOf(address(bond)), reserveBefore, "protected reserve changed");
        assertEq(token.balanceOf(BENEFICIARY), beneficiaryBefore, "beneficiary balance changed");
        assertEq(uint256(bond.state()), uint256(DividendBond.State.Active), "event consumed by rejected proof");
        assertEq(bond.claimedAmount(), 0);
        return reason;
    }

    function testIndependentCanonicalRequestMatchesRealFixture() public view {
        // This is the canonical POST request identity, calculated without using response.requestHash.
        bytes32 computed = keccak256(
            '["dividendHistory",[["from","2025-08-11"],["ticker","AAPL.US"],["to","2025-08-11"]],[["currency","/0/currency"],["declaredDividend","/0/unadjustedValue"],["eventDate","/0/date"],["paymentDate","/0/paymentDate"],["recordDate","/0/recordDate"]]]'
        );
        assertEq(computed, EXPECTED_REQUEST);
        assertEq(realProof.requestHash, computed);
        assertEq(
            AirnodeV2Attestation.recoverSigner(computed, realProof.timestamp, realProof.data, realProof.signature),
            EODHD
        );
    }

    function testRealTimelyProofPays26TestUsdToStoredBeneficiary() public {
        vm.prank(KEEPER);
        bond.claimFor(realProof.timestamp, realProof.data, realProof.signature);
        assertEq(token.balanceOf(BENEFICIARY), 26e6);
        assertEq(token.balanceOf(KEEPER), 0);
        assertEq(token.balanceOf(address(this)), 974e6);
        assertEq(token.balanceOf(address(bond)), 0);
        assertEq(bond.declaredDividendE18(), 0.26e18);
        assertEq(bond.claimedAmount(), 26e6);
        assertEq(uint256(bond.state()), uint256(DividendBond.State.Claimed));
    }

    function testRealProofWithEditedValueRejectsBeforePayout() public {
        Proof memory edited = realProof;
        edited.data = bytes(
            '{"currency":"USD","declaredDividend":0.99,"eventDate":"2025-08-11","paymentDate":"2025-08-14","recordDate":"2025-08-11"}'
        );
        assertEq(bytes4(_reject(edited)), AirnodeV2Attestation.NotSignedByAirnode.selector);
    }

    function testRealUneditedProofBecomesStaleAfter301Seconds() public {
        vm.warp(realProof.timestamp + 301);
        assertEq(bytes4(_reject(realProof)), DividendBond.ResponseTooOld.selector);
    }

    function testDifferentRealEodhdRequestAuthenticatesButCannotClaimDividend() public {
        Proof memory different = _load("test/fixtures/real-eodhd-wrong-request.json");
        bytes32 canonicalSearchHash = keccak256('["searchInstruments",[["limit",1],["query","AAPL"]]]');
        assertEq(different.requestHash, canonicalSearchHash);
        assertNotEq(canonicalSearchHash, EXPECTED_REQUEST);
        assertEq(
            AirnodeV2Attestation.recoverSigner(
                canonicalSearchHash, different.timestamp, different.data, different.signature
            ),
            EODHD
        );
        vm.warp(different.timestamp);
        assertEq(bytes4(_reject(different)), AirnodeV2Attestation.NotSignedByAirnode.selector);
    }

    function testLocalWrongSignerCannotForgeRealProof() public {
        Proof memory forged = realProof;
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encodePacked(EXPECTED_REQUEST, forged.timestamp, forged.data))
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBAD, digest);
        forged.signature = abi.encodePacked(r, s, v);
        assertEq(bytes4(_reject(forged)), AirnodeV2Attestation.NotSignedByAirnode.selector);
    }

    function testRealDuplicateProofCannotTriggerSecondPayout() public {
        bond.claimFor(realProof.timestamp, realProof.data, realProof.signature);
        uint256 issuerBefore = token.balanceOf(address(this));
        vm.expectRevert(abi.encodeWithSelector(DividendBond.InvalidState.selector, DividendBond.State.Claimed));
        vm.prank(KEEPER);
        bond.claimFor(realProof.timestamp, realProof.data, realProof.signature);
        assertEq(token.balanceOf(BENEFICIARY), 26e6);
        assertEq(token.balanceOf(address(this)), issuerBefore);
        assertEq(token.balanceOf(address(bond)), 0);
        assertEq(uint256(bond.state()), uint256(DividendBond.State.Claimed));
    }
}
