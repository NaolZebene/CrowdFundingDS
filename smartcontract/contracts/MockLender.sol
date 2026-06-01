// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Like {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

/**
 * @title MockLender
 * @notice Deterministic manual-testing lender.
 *         Principal is supplied by CrowdVault. Real, claimable yield is seeded
 *         by transferring USDC through addYield() or by dripping from a funded
 *         reserve, then harvested by the vault.
 */
contract MockLender {
    IERC20Like public immutable usdc;
    address public admin;

    uint256 public apyBps = 0;         // display/config placeholder for tests
    uint256 public dripBps = 1;        // 0.01% of supplied principal per drip
    uint256 public totalSupplied;      // principal deposited by vault
    uint256 public lastAccrualTime;    // timestamp of last accrual snapshot
    uint256 public accruedYield;       // real USDC yield seeded with addYield()
    uint256 public reserveBalance;     // USDC reserve available for tiny yield drips

    event Supplied(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event YieldWithdrawn(address indexed to, uint256 amount);
    event YieldAdded(uint256 amount);
    event ReserveFunded(uint256 amount);
    event ReserveDripped(uint256 amount);
    event ApySet(uint256 apyBps);
    event DripBpsSet(uint256 dripBps);

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    constructor(address usdc_) {
        usdc = IERC20Like(usdc_);
        admin = msg.sender;
        lastAccrualTime = block.timestamp;
    }

    // ── Internal accrual ────────────────────────────────────────────────────

    function _accrue() internal {
        lastAccrualTime = block.timestamp;
    }

    // ── ILender interface ────────────────────────────────────────────────────

    function supply(uint256 amount) external {
        require(amount > 0, "amount=0");
        _accrue();
        require(usdc.transferFrom(msg.sender, address(this), amount), "tf");
        totalSupplied += amount;
        emit Supplied(msg.sender, amount);
    }

    function withdraw(uint256 amount, address to) external {
        require(to != address(0), "to=0");
        _accrue();
        require(amount <= totalSupplied + accruedYield, "bal");
        // Reduce principal first; remainder comes from accrued yield
        if (amount <= totalSupplied) {
            totalSupplied -= amount;
        } else {
            uint256 fromYield = amount - totalSupplied;
            totalSupplied = 0;
            accruedYield = accruedYield > fromYield ? accruedYield - fromYield : 0;
        }
        require(usdc.balanceOf(address(this)) >= amount, "liq");
        require(usdc.transfer(to, amount), "t");
        emit Withdrawn(to, amount);
    }

    function withdrawYield(uint256 amount, address to) external {
        require(to != address(0), "to=0");
        _accrue();
        require(amount <= accruedYield, "yield");
        accruedYield -= amount;
        require(usdc.balanceOf(address(this)) >= amount, "liq");
        require(usdc.transfer(to, amount), "t");
        emit YieldWithdrawn(to, amount);
    }

    /**
     * @notice Returns principal + real claimable yield.
     *         Reserve funds are intentionally excluded until dripped.
     *         This is what CrowdVault.harvestYield() reads to compute yield delta.
     */
    function balance() external view returns (uint256) {
        return totalSupplied + accruedYield;
    }

    // ── Admin helpers ────────────────────────────────────────────────────────

    /**
     * @notice Stores a test APY label for UI/admin experiments.
     *         Real test yield still comes from addYield().
     */
    function setApy(uint256 apyBps_) external onlyAdmin {
        _accrue();
        apyBps = apyBps_;
        emit ApySet(apyBps_);
    }

    /**
     * @notice Sets the reserve drip rate. 1 bps = 0.01% of totalSupplied per drip.
     */
    function setDripBps(uint256 dripBps_) external onlyAdmin {
        require(dripBps_ <= 100, "drip too high");
        _accrue();
        dripBps = dripBps_;
        emit DripBpsSet(dripBps_);
    }

    /**
     * @notice Instantly inject yield by transferring USDC into the lender.
     *         Kept for backward compatibility with the seed:yield script.
     */
    function addYield(uint256 amount) external onlyAdmin {
        require(amount > 0, "amount=0");
        _accrue();
        require(usdc.transferFrom(msg.sender, address(this), amount), "tf");
        accruedYield += amount;
        emit YieldAdded(amount);
    }

    /**
     * @notice Funds the lender reserve. Reserve does not become claimable yield
     *         until dripReserveYield() moves a tiny portion into accruedYield.
     */
    function fundReserve(uint256 amount) external onlyAdmin {
        require(amount > 0, "amount=0");
        _accrue();
        require(usdc.transferFrom(msg.sender, address(this), amount), "tf");
        reserveBalance += amount;
        emit ReserveFunded(amount);
    }

    /**
     * @notice Moves a tiny amount from reserve into claimable lender yield.
     *         Useful for repeatedly testing claims without draining reserves.
     */
    function dripReserveYield() external onlyAdmin returns (uint256 amount) {
        _accrue();
        if (reserveBalance == 0 || totalSupplied == 0 || dripBps == 0) return 0;

        amount = (totalSupplied * dripBps) / 10_000;
        if (amount == 0) amount = 1;
        if (amount > reserveBalance) amount = reserveBalance;

        reserveBalance -= amount;
        accruedYield += amount;
        emit ReserveDripped(amount);
    }
}
