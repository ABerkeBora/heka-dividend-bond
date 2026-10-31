// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {AirnodeV2Attestation} from "./vendor/AirnodeV2Attestation.sol";
import {ProjectedJson} from "./vendor/ProjectedJson.sol";

/// @title One prefunded, immutable synthetic dividend obligation
/// @notice Any caller can submit the pinned EODHD response. Only the stored beneficiary receives the payout.
/// @dev Source authenticity is not proof of real brokerage ownership, backing or upstream truth.
contract DividendBond is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_RESPONSE_AGE = 300;
    uint256 public constant FUTURE_CLOCK_SKEW = 60;
    uint256 public constant MAX_QUANTITY_E18 = 1_000_000e18;
    uint256 public constant MAX_DIVIDEND_E18 = 1_000_000e18;

    enum State {
        AwaitingFunding,
        Active,
        Claimed,
        Void
    }

    struct Terms {
        address asset;
        address beneficiary;
        address airnode;
        bytes32 requestHash;
        string ticker;
        uint256 eventDate;
        uint256 paymentDate;
        uint256 quantityE18;
        uint256 payoutCap;
        uint256 earliestSettlement;
        uint256 claimDeadline;
        uint256 voidGrace;
    }

    IERC20 public immutable asset;
    address public immutable issuer;
    address public immutable beneficiary;
    address public immutable airnode;
    bytes32 public immutable requestHash;
    string public ticker;
    uint256 public immutable eventDate;
    uint256 public immutable paymentDate;
    uint256 public immutable quantityE18;
    uint256 public immutable payoutCap;
    uint256 public immutable earliestSettlement;
    uint256 public immutable claimDeadline;
    uint256 public immutable voidGrace;

    State public state;
    uint256 public fundedAt;
    uint256 public claimTimestamp;
    uint256 public claimedAmount;
    uint256 public declaredDividendE18;

    error InvalidTerms();
    error OnlyIssuer();
    error InvalidState(State current);
    error InsufficientReserve();
    error TooEarly();
    error ClaimWindowClosed();
    error VoidTooEarly();
    error ResponseTooOld(uint256 timestamp);
    error ResponseFromFuture(uint256 timestamp);
    error WrongEvent();
    error WrongPaymentDate();
    error InvalidRecordDate();
    error WrongCurrency();
    error InvalidDividend();

    event Funded(address indexed issuer, uint256 amount);
    event Claimed(
        address indexed beneficiary, address indexed submitter, uint256 amount, uint256 dividendE18, uint256 signedAt
    );
    event ReserveReturned(address indexed issuer, uint256 amount);
    event Voided(address indexed issuer, uint256 amount);

    constructor(Terms memory terms) {
        if (
            terms.asset.code.length == 0 || terms.beneficiary == address(0) || terms.beneficiary == msg.sender
                || terms.airnode == address(0) || terms.requestHash == bytes32(0) || bytes(terms.ticker).length == 0
                || terms.eventDate == 0 || terms.paymentDate < terms.eventDate || terms.quantityE18 == 0
                || terms.quantityE18 > MAX_QUANTITY_E18 || terms.payoutCap == 0
                || terms.earliestSettlement < terms.paymentDate || terms.claimDeadline <= block.timestamp
                || terms.claimDeadline <= terms.earliestSettlement || terms.claimDeadline > block.timestamp + 30 days
                || terms.voidGrace > 7 days || IERC20Metadata(terms.asset).decimals() != 6
        ) revert InvalidTerms();
        asset = IERC20(terms.asset);
        issuer = msg.sender;
        beneficiary = terms.beneficiary;
        airnode = terms.airnode;
        requestHash = terms.requestHash;
        ticker = terms.ticker;
        eventDate = terms.eventDate;
        paymentDate = terms.paymentDate;
        quantityE18 = terms.quantityE18;
        payoutCap = terms.payoutCap;
        earliestSettlement = terms.earliestSettlement;
        claimDeadline = terms.claimDeadline;
        voidGrace = terms.voidGrace;
    }

    /// @notice Locks the whole payout cap before any claim. Terms cannot be edited before or after funding.
    function fund() external nonReentrant {
        if (msg.sender != issuer) revert OnlyIssuer();
        if (state != State.AwaitingFunding) revert InvalidState(state);
        if (block.timestamp > claimDeadline) revert ClaimWindowClosed();
        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(issuer, address(this), payoutCap);
        if (asset.balanceOf(address(this)) < beforeBalance + payoutCap) revert InsufficientReserve();
        state = State.Active;
        fundedAt = block.timestamp;
        emit Funded(issuer, payoutCap);
    }

    /// @notice Fixed-point quantity and declared USD per unit yield six-decimal collateral, rounded down once.
    /// @dev The source dividend is read at 18 decimals; digits beyond 18 are discarded by the official parser.
    function previewPayout(uint256 dividendE18) public view returns (uint256 payout) {
        if (dividendE18 == 0 || dividendE18 > MAX_DIVIDEND_E18) revert InvalidDividend();
        payout = Math.mulDiv(quantityE18, dividendE18, 1e30);
        if (payout > payoutCap) payout = payoutCap;
        if (payout == 0) revert InvalidDividend();
    }

    /// @notice Checks proof policy without changing state or requiring the caller to own the position.
    /// @dev Does not check funding/one-time consumption; claimFor does. Useful for judges after a successful claim.
    function validateResponse(uint256 timestamp, bytes memory data, bytes memory signature)
        public
        view
        returns (uint256 dividendE18, uint256 payout)
    {
        AirnodeV2Attestation.verify(airnode, requestHash, timestamp, data, signature);
        if (timestamp > block.timestamp + FUTURE_CLOCK_SKEW) revert ResponseFromFuture(timestamp);
        if (timestamp < block.timestamp && block.timestamp - timestamp > MAX_RESPONSE_AGE) {
            revert ResponseTooOld(timestamp);
        }
        if (ProjectedJson.readTimestamp(data, "eventDate") != eventDate) revert WrongEvent();
        uint256 observedPaymentDate = ProjectedJson.readTimestamp(data, "paymentDate");
        if (observedPaymentDate != paymentDate) revert WrongPaymentDate();
        if (observedPaymentDate > block.timestamp || block.timestamp < earliestSettlement) revert TooEarly();
        uint256 recordDate = ProjectedJson.readTimestamp(data, "recordDate");
        if (recordDate < eventDate || recordDate > paymentDate) revert InvalidRecordDate();
        if (keccak256(bytes(ProjectedJson.readString(data, "currency"))) != keccak256("USD")) revert WrongCurrency();
        dividendE18 = ProjectedJson.readUint(data, "declaredDividend", 18);
        payout = previewPayout(dividendE18);
    }

    /// @notice A keeper or delegated agent triggers collection; destination comes only from the immutable agreement.
    /// @dev A transaction has no user-supplied payout amount, recipient or arbitrary calldata destination.
    function claimFor(uint256 timestamp, bytes memory data, bytes memory signature) external nonReentrant {
        if (state != State.Active) revert InvalidState(state);
        if (block.timestamp > claimDeadline + voidGrace) revert ClaimWindowClosed();
        (uint256 dividendE18, uint256 payout) = validateResponse(timestamp, data, signature);
        if (asset.balanceOf(address(this)) < payoutCap) revert InsufficientReserve();
        state = State.Claimed;
        claimTimestamp = block.timestamp;
        claimedAmount = payout;
        declaredDividendE18 = dividendE18;
        asset.safeTransfer(beneficiary, payout);
        uint256 surplus = payoutCap - payout;
        if (surplus != 0) {
            asset.safeTransfer(issuer, surplus);
            emit ReserveReturned(issuer, surplus);
        }
        emit Claimed(beneficiary, msg.sender, payout, dividendE18, timestamp);
    }

    /// @notice The pre-agreed no-data timeout releases the reserve to the issuer; nobody adjudicates data absence.
    /// @dev The grace period is still a claimable window. At exactly deadline+grace claims remain possible.
    function voidExpired() external nonReentrant {
        if (state != State.Active) revert InvalidState(state);
        if (block.timestamp <= claimDeadline + voidGrace) revert VoidTooEarly();
        state = State.Void;
        asset.safeTransfer(issuer, payoutCap);
        emit Voided(issuer, payoutCap);
    }
}
