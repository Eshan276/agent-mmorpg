// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title GameGold — in-game currency token (GGLD)
/// Server wallet and GameAMM hold MINTER_ROLE.
contract GoldToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address serverWallet) ERC20("GameGold", "GGLD") {
        _grantRole(DEFAULT_ADMIN_ROLE, serverWallet);
        _grantRole(MINTER_ROLE, serverWallet);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /// Called by GameAMM on buy() to destroy agent's GGLD payment.
    function burn(address from, uint256 amount) external onlyRole(MINTER_ROLE) {
        _burn(from, amount);
    }

    function grantMinter(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MINTER_ROLE, account);
    }
}
