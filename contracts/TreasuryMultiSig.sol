// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Mini {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract TreasuryMultiSig {
    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public threshold; // 2 for 2/3, 3 for 3/5, etc.

    struct Txn {
        address token;
        address to;
        uint256 amount;
        bool executed;
        uint256 approvals;
    }

    Txn[] public txns;
    mapping(uint256 => mapping(address => bool)) public approved;

    event Proposed(uint256 indexed txId, address token, address to, uint256 amount);
    event Approved(uint256 indexed txId, address indexed owner);
    event Executed(uint256 indexed txId);

    modifier onlyOwner() {
        require(isOwner[msg.sender], "not owner");
        _;
    }

    constructor(address[] memory owners_, uint256 threshold_) {
        require(owners_.length >= 3, "need >=3 owners");
        require(threshold_ > 0 && threshold_ <= owners_.length, "bad threshold");

        for (uint256 i = 0; i < owners_.length; i++) {
            address o = owners_[i];
            require(o != address(0), "zero");
            require(!isOwner[o], "dup");
            isOwner[o] = true;
            owners.push(o);
        }
        threshold = threshold_;
    }

    function propose(address token, address to, uint256 amount) external onlyOwner returns (uint256 txId) {
        require(to != address(0), "to=0");
        require(amount > 0, "amount=0");
        txns.push(Txn({token: token, to: to, amount: amount, executed: false, approvals: 0}));
        txId = txns.length - 1;
        emit Proposed(txId, token, to, amount);
    }

    function approve(uint256 txId) external onlyOwner {
        Txn storage t = txns[txId];
        require(!t.executed, "executed");
        require(!approved[txId][msg.sender], "already");
        approved[txId][msg.sender] = true;
        t.approvals += 1;
        emit Approved(txId, msg.sender);
    }

    function execute(uint256 txId) external onlyOwner {
        Txn storage t = txns[txId];
        require(!t.executed, "executed");
        require(t.approvals >= threshold, "not enough approvals");
        t.executed = true;
        require(IERC20Mini(t.token).transfer(t.to, t.amount), "transfer failed");
        emit Executed(txId);
    }

    function ownersCount() external view returns (uint256) {
        return owners.length;
    }
}