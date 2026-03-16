// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockZKVerifier {
    address public admin;
    mapping(address => bool) public kycOk;

    event KycSet(address indexed user, bool ok);

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function setKyc(address user, bool ok) external onlyAdmin {
        kycOk[user] = ok;
        emit KycSet(user, ok);
    }

    // proof is ignored in mock; real provider would verify proof
    function verify(address user, bytes calldata) external view returns (bool) {
        return kycOk[user];
    }
}