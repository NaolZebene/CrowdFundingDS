// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TreasuryMultiSigV2 {
    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public threshold; // e.g., 2 for 2/3

    struct Txn {
        address target;
        uint256 value;
        bytes data;
        bool executed;
        uint256 approvals;
    }

    Txn[] public txns;
    mapping(uint256 => mapping(address => bool)) public approved;

    event Proposed(uint256 indexed txId, address indexed target, uint256 value, bytes data);
    event Approved(uint256 indexed txId, address indexed owner);
    event Executed(uint256 indexed txId, bool success, bytes returnData);

    modifier onlyOwner() {
        require(isOwner[msg.sender], "not owner");
        _;
    }

    constructor(address[] memory owners_, uint256 threshold_) {
        require(owners_.length >= 3, "need >=3 owners");
        require(threshold_ > 0 && threshold_ <= owners_.length, "bad threshold");

        for (uint256 i = 0; i < owners_.length; i++) {
            address o = owners_[i];
            require(o != address(0), "zero owner");
            require(!isOwner[o], "dup owner");
            isOwner[o] = true;
            owners.push(o);
        }
        threshold = threshold_;
    }

    function ownersCount() external view returns (uint256) {
        return owners.length;
    }

    function propose(address target, uint256 value, bytes calldata data) external onlyOwner returns (uint256 txId) {
        require(target != address(0), "target=0");
        txns.push(Txn({
            target: target,
            value: value,
            data: data,
            executed: false,
            approvals: 0
        }));
        txId = txns.length - 1;
        emit Proposed(txId, target, value, data);
    }

    function approve(uint256 txId) external onlyOwner {
        Txn storage t = txns[txId];
        require(!t.executed, "executed");
        require(!approved[txId][msg.sender], "already approved");

        approved[txId][msg.sender] = true;
        t.approvals += 1;

        emit Approved(txId, msg.sender);
    }

    function execute(uint256 txId) external onlyOwner {
        Txn storage t = txns[txId];
        require(!t.executed, "executed");
        require(t.approvals >= threshold, "not enough approvals");

        t.executed = true;

        (bool ok, bytes memory ret) = t.target.call{value: t.value}(t.data);
        emit Executed(txId, ok, ret);
        require(ok, "call failed");
    }

    receive() external payable {}
}
