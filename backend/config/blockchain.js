const { ethers } = require("ethers");

// Load environment variables
const PRIVATE_KEY = process.env.ETHEREUM_PRIVATE_KEY;
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0xe449415712aF0fF15dff12cf9d8E73CEf835bDc6";

// Contract ABI (minimal for backend operations)
const CONTRACT_ABI = [
  "function donate(string calldata message) external payable",
  "function totalDonated() external view returns (uint256)",
  "function goalAmount() external view returns (uint256)",
  "function coveragePercent() public view returns (uint256)",
  "function getBalance() external view returns (uint256)",
  "function getDonationCount() external view returns (uint256)",
  "function getDeploymentCount() external view returns (uint256)",
  "function getAllDonations() external view returns (tuple(address donor, uint256 amount, uint256 timestamp, string message)[])",
  "function getAllDeployments() external view returns (tuple(uint256 amount, string purpose, uint256 timestamp, address authorizedBy)[])",
  "function disasterContext() external view returns (string)",
  "function updateGoal(uint256 _newGoalInWei) external",
  "function updateContext(string calldata _context) external",
  "function authorizeDeployment(uint256 amount, string calldata purpose) external",
  "event DonationReceived(address indexed donor, uint256 amount, string message, uint256 timestamp)",
];

// Server wallet provider (for backend transactions)
const getServerWallet = () => {
  if (!PRIVATE_KEY) {
    throw new Error("ETHEREUM_PRIVATE_KEY not set in .env file");
  }
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  return wallet;
};

// Get contract instance with server wallet (for writing)
const getServerContract = () => {
  const wallet = getServerWallet();
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
};

// Get contract instance for reading only
const getReadOnlyContract = () => {
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
};

module.exports = {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  getServerWallet,
  getServerContract,
  getReadOnlyContract,
  EXPLORER_URL: "https://sepolia.etherscan.io"
};