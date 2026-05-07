// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract KulaPublicRegistry is ERC721URIStorage, Ownable {
    struct PublicAsset {
        uint256 id;
        address poster;
        string title;
        string documentCid;
        uint256 askPrice;
        uint256 communityTrustScore;
        bool isVerified;
        bool isMinted;
    }

    mapping(uint256 => PublicAsset) public assets;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    uint256 public assetCount;
    uint256 private _tokenIds;

    constructor() ERC721("Kula Trust Equity", "KULA-RWA") Ownable(msg.sender) {}

    function listAsset(string memory _title, string memory _cid, uint256 _price) external {
        assetCount++;
        assets[assetCount] = PublicAsset(assetCount, msg.sender, _title, _cid, _price, 0, false, false);
    }

    function verifyAsset(uint256 _id) external {
        require(!hasVoted[_id][msg.sender], "Already verified by you");
        assets[_id].communityTrustScore++;
        hasVoted[_id][msg.sender] = true;
        
        if(assets[_id].communityTrustScore >= 50) {
            assets[_id].isVerified = true;
        }
    }

    // This function mints the actual RWA NFT once verified
    function mintTrustEquity(uint256 _assetId) external {
        PublicAsset storage asset = assets[_assetId];
        require(asset.isVerified, "Asset not yet community certified");
        require(!asset.isMinted, "Trust Equity already minted");
        require(msg.sender == asset.poster, "Only the owner can mint");

        _tokenIds++;
        uint256 newTokenId = _tokenIds;

        _safeMint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, string(abi.encodePacked("ipfs://", asset.documentCid)));
        
        asset.isMinted = true;
    }
}
