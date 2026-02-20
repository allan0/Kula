// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LendingPool {
    IERC20 public usdc;
    mapping(address => uint256) public savings;

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function deposit(uint256 _amount) external {
        require(usdc.transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        savings[msg.sender] += _amount;
    }
}
