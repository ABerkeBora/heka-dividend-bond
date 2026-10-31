// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {DividendBond} from "../contracts/DividendBond.sol";
import {TestDividendUSD} from "../contracts/TestDividendUSD.sol";
import {IsoTimestamp} from "../contracts/vendor/IsoTimestamp.sol";

/// @notice Policy/unit tests use a labeled local signer. Separate real-proof tests are added from captured Airnode data.
contract DividendBondTest is Test {
    uint256 private constant LOCAL_SIGNER_KEY = 0xA11CE;
    bytes32 private constant REQUEST = keccak256("synthetic-unit-test-request");
    address private beneficiary = address(0xB0B);
    address private keeper = address(0xCAFE);
    TestDividendUSD private token;
    DividendBond private bond;
    uint256 private start;

    function setUp() public {
        vm.warp(1_793_414_400);
        start = block.timestamp;
        token = new TestDividendUSD(address(this), 1_000e6);
        bond = new DividendBond(_terms(100e18, 50e6));
        token.approve(address(bond), 50e6);
        bond.fund();
    }

    function _terms(uint256 quantity, uint256 cap) private view returns (DividendBond.Terms memory) {
        return DividendBond.Terms({
            asset: address(token),
            beneficiary: beneficiary,
            airnode: vm.addr(LOCAL_SIGNER_KEY),
            requestHash: REQUEST,
            ticker: "AAPL.US",
            eventDate: IsoTimestamp.parse("2025-08-11"),
            paymentDate: IsoTimestamp.parse("2025-08-14"),
            quantityE18: quantity,
            payoutCap: cap,
            earliestSettlement: IsoTimestamp.parse("2025-08-14"),
            claimDeadline: block.timestamp + 24 hours,
            voidGrace: 1 hours
        });
    }

    function _data(string memory rate) private pure returns (bytes memory) {
        return bytes(
            string.concat(
                '{"currency":"USD","declaredDividend":',
                rate,
                ',"eventDate":"2025-08-11","paymentDate":"2025-08-14","recordDate":"2025-08-11"}'
            )
        );
    }

    function _sign(bytes32 request, uint256 timestamp, bytes memory data, uint256 signerKey)
        private
        pure
        returns (bytes memory)
    {
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(keccak256(abi.encodePacked(request, timestamp, data)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _signature(uint256 timestamp, bytes memory data) private pure returns (bytes memory) {
        return _sign(REQUEST, timestamp, data, LOCAL_SIGNER_KEY);
    }

    function _assertRejected(uint256 timestamp, bytes memory data, bytes memory signature)
        private
        returns (bytes memory)
    {
        uint256 reserveBefore = token.balanceOf(address(bond));
        uint256 beneficiaryBefore = token.balanceOf(beneficiary);
        uint256 issuerBefore = token.balanceOf(address(this));
        (bool success, bytes memory revertData) =
            address(bond).call(abi.encodeCall(DividendBond.claimFor, (timestamp, data, signature)));
        assertFalse(success, "bad proof was accepted");
        assertEq(token.balanceOf(address(bond)), reserveBefore, "protected reserve changed");
        assertEq(token.balanceOf(beneficiary), beneficiaryBefore, "beneficiary paid on rejection");
        assertEq(token.balanceOf(address(this)), issuerBefore, "issuer reserve returned on rejection");
        assertEq(uint256(bond.state()), uint256(DividendBond.State.Active), "consumption flag changed");
        assertEq(bond.claimedAmount(), 0, "claimed amount changed");
        return revertData;
    }

    function testPrefundedPermissionlessClaimPaysOnlyBeneficiary() public {
        bytes memory data = _data("0.26");
        bytes memory sig = _signature(start, data);
        (uint256 rate, uint256 preview) = bond.validateResponse(start, data, sig);
        assertEq(rate, 0.26e18);
        assertEq(preview, 26e6);
        assertEq(token.balanceOf(address(bond)), 50e6);
        vm.prank(keeper);
        bond.claimFor(start, data, sig);
        assertEq(token.balanceOf(beneficiary), 26e6);
        assertEq(token.balanceOf(keeper), 0);
        assertEq(token.balanceOf(address(this)), 974e6);
        assertEq(token.balanceOf(address(bond)), 0);
        assertEq(bond.claimedAmount(), 26e6);
        assertEq(uint256(bond.state()), uint256(DividendBond.State.Claimed));
    }

    function testRejectEditedResponsePreservesFundsAndFlag() public {
        bytes memory original = _data("0.26");
        _assertRejected(start, _data("0.99"), _signature(start, original));
    }

    function testRejectStaleResponsePreservesFundsAndFlag() public {
        bytes memory data = _data("0.26");
        bytes memory sig = _signature(start, data);
        vm.warp(start + 301);
        bytes memory err = _assertRejected(start, data, sig);
        assertEq(bytes4(err), DividendBond.ResponseTooOld.selector);
    }

    function testRejectWrongRequestPreservesFundsAndFlag() public {
        bytes memory data = _data("0.26");
        _assertRejected(start, data, _sign(keccak256("different-projection"), start, data, LOCAL_SIGNER_KEY));
    }

    function testRejectWrongSignerPreservesFundsAndFlag() public {
        bytes memory data = _data("0.26");
        _assertRejected(start, data, _sign(REQUEST, start, data, 0xBAD));
    }

    function testRejectFutureSignedResponse() public {
        bytes memory data = _data("0.26");
        bytes memory err = _assertRejected(start + 61, data, _signature(start + 61, data));
        assertEq(bytes4(err), DividendBond.ResponseFromFuture.selector);
    }

    function testAcceptFreshnessAndFutureBoundary() public {
        bytes memory data = _data("0.26");
        bond.validateResponse(start - 300, data, _signature(start - 300, data));
        bond.validateResponse(start + 60, data, _signature(start + 60, data));
    }

    function testDuplicateClaimCannotPayTwice() public {
        bytes memory data = _data("0.26");
        bytes memory sig = _signature(start, data);
        bond.claimFor(start, data, sig);
        vm.expectRevert(abi.encodeWithSelector(DividendBond.InvalidState.selector, DividendBond.State.Claimed));
        bond.claimFor(start, data, sig);
        assertEq(token.balanceOf(beneficiary), 26e6);
        assertEq(bond.claimedAmount(), 26e6);
    }

    function testCapIsEnforcedAndUnusedReserveReturnsIssuer() public {
        bytes memory data = _data("2.00");
        bond.claimFor(start, data, _signature(start, data));
        assertEq(token.balanceOf(beneficiary), 50e6);
        assertEq(token.balanceOf(address(this)), 950e6);
        assertEq(token.balanceOf(address(bond)), 0);
    }

    function testFractionalQuantityRoundsDownOnlyAtTokenPrecision() public {
        DividendBond fractional = new DividendBond(_terms(1.234567891e18, 50e6));
        assertEq(fractional.previewPayout(0.123456789e18), 152415);
        assertEq(fractional.previewPayout(0.000001e18), 1);
    }

    function testNumericStringAcceptedAndExtraDigitsTruncatedAt18Decimals() public {
        bytes memory data = _data('"0.2600000000000000009"');
        (uint256 rate, uint256 payout) = bond.validateResponse(start, data, _signature(start, data));
        assertEq(rate, 0.26e18);
        assertEq(payout, 26e6);
    }

    function testZeroDividendRejects() public {
        bytes memory data = _data("0");
        _assertRejected(start, data, _signature(start, data));
    }

    function testNegativeDividendRejects() public {
        bytes memory data = _data("-0.26");
        _assertRejected(start, data, _signature(start, data));
    }

    function testOversizeDividendRejects() public {
        bytes memory data = _data("1000001");
        _assertRejected(start, data, _signature(start, data));
    }

    function testOverflowDividendRejects() public {
        bytes memory data = _data("99999999999999999999999999999999999999999999999999999999999999999999999999999");
        _assertRejected(start, data, _signature(start, data));
    }

    function testNullDividendRejects() public {
        bytes memory data = _data("null");
        _assertRejected(start, data, _signature(start, data));
    }

    function testWrongEventRejects() public {
        bytes memory data = bytes(
            '{"currency":"USD","declaredDividend":0.26,"eventDate":"2025-08-12","paymentDate":"2025-08-14","recordDate":"2025-08-11"}'
        );
        _assertRejected(start, data, _signature(start, data));
    }

    function testWrongPaymentDateRejects() public {
        bytes memory data = bytes(
            '{"currency":"USD","declaredDividend":0.26,"eventDate":"2025-08-11","paymentDate":"2025-08-15","recordDate":"2025-08-11"}'
        );
        _assertRejected(start, data, _signature(start, data));
    }

    function testWrongCurrencyRejects() public {
        bytes memory data = bytes(
            '{"currency":"EUR","declaredDividend":0.26,"eventDate":"2025-08-11","paymentDate":"2025-08-14","recordDate":"2025-08-11"}'
        );
        _assertRejected(start, data, _signature(start, data));
    }

    function testMissingRequiredFieldRejects() public {
        bytes memory data =
            bytes('{"currency":"USD","eventDate":"2025-08-11","paymentDate":"2025-08-14","recordDate":"2025-08-11"}');
        _assertRejected(start, data, _signature(start, data));
    }

    function testNullDateRejects() public {
        bytes memory data = bytes(
            '{"currency":"USD","declaredDividend":0.26,"eventDate":"2025-08-11","paymentDate":null,"recordDate":"2025-08-11"}'
        );
        _assertRejected(start, data, _signature(start, data));
    }

    function testNullRecordDateRejects() public {
        bytes memory data = bytes(
            '{"currency":"USD","declaredDividend":0.26,"eventDate":"2025-08-11","paymentDate":"2025-08-14","recordDate":null}'
        );
        _assertRejected(start, data, _signature(start, data));
    }

    function testReserveCannotReturnBeforeDeadlineAndGrace() public {
        vm.warp(bond.claimDeadline() + bond.voidGrace());
        vm.expectRevert(DividendBond.VoidTooEarly.selector);
        bond.voidExpired();
        assertEq(token.balanceOf(address(bond)), 50e6);
    }

    function testClaimStillAllowedDuringGrace() public {
        vm.warp(bond.claimDeadline() + 10);
        bytes memory data = _data("0.26");
        bond.claimFor(block.timestamp, data, _signature(block.timestamp, data));
        assertEq(token.balanceOf(beneficiary), 26e6);
    }

    function testAfterGraceOnlyVoidRefundIsPossible() public {
        vm.warp(bond.claimDeadline() + bond.voidGrace() + 1);
        bytes memory data = _data("0.26");
        _assertRejected(block.timestamp, data, _signature(block.timestamp, data));
        vm.prank(keeper);
        bond.voidExpired();
        assertEq(uint256(bond.state()), uint256(DividendBond.State.Void));
        assertEq(token.balanceOf(address(bond)), 0);
        assertEq(token.balanceOf(address(this)), 1_000e6);
        assertEq(token.balanceOf(beneficiary), 0);
    }

    function testOnlyIssuerCanFundAndNoDuplicateFunding() public {
        DividendBond fresh = new DividendBond(_terms(100e18, 50e6));
        vm.prank(keeper);
        vm.expectRevert(DividendBond.OnlyIssuer.selector);
        fresh.fund();
        vm.expectRevert(abi.encodeWithSelector(DividendBond.InvalidState.selector, DividendBond.State.Active));
        bond.fund();
    }

    function testUnfundedCannotClaim() public {
        DividendBond fresh = new DividendBond(_terms(100e18, 50e6));
        bytes memory data = _data("0.26");
        vm.expectRevert(abi.encodeWithSelector(DividendBond.InvalidState.selector, DividendBond.State.AwaitingFunding));
        fresh.claimFor(start, data, _signature(start, data));
    }

    function testInvalidTermsRejectsZeroQuantityAndSelfPayment() public {
        DividendBond.Terms memory terms = _terms(0, 50e6);
        vm.expectRevert(DividendBond.InvalidTerms.selector);
        new DividendBond(terms);
        terms = _terms(100e18, 50e6);
        terms.beneficiary = address(this);
        vm.expectRevert(DividendBond.InvalidTerms.selector);
        new DividendBond(terms);
    }

    function testFuzzIntegerRoundingAndCap(uint256 quantity, uint256 rate) public {
        quantity = bound(quantity, 1e18, 1_000_000e18);
        rate = bound(rate, 1e18, 1_000_000e18);
        DividendBond fresh = new DividendBond(_terms(quantity, 50e6));
        uint256 expected = quantity * rate / 1e30;
        if (expected > 50e6) expected = 50e6;
        assertEq(fresh.previewPayout(rate), expected);
    }
}
