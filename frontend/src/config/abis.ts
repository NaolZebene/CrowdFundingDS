export const AMM_ABI = [
  { name: "isAdmin",            type: "function", stateMutability: "view",        inputs: [{ name: "user", type: "address" }],                                                       outputs: [{ type: "bool"    }] },
  { name: "admin",              type: "function", stateMutability: "view",        inputs: [],                                                                                         outputs: [{ type: "address" }] },
  { name: "pendingAdmin",       type: "function", stateMutability: "view",        inputs: [],                                                                                         outputs: [{ type: "address" }] },
  { name: "poolUsdc",           type: "function", stateMutability: "view",        inputs: [{ name: "projectId", type: "uint256" }],                                                                          outputs: [{ type: "uint256" }] },
  { name: "poolCommit",         type: "function", stateMutability: "view",        inputs: [{ name: "projectId", type: "uint256" }],                                                                          outputs: [{ type: "uint256" }] },
  { name: "seeded",             type: "function", stateMutability: "view",        inputs: [{ name: "projectId", type: "uint256" }],                                                                          outputs: [{ type: "bool"    }] },
  { name: "feeBps",             type: "function", stateMutability: "view",        inputs: [],                                                                                                                 outputs: [{ type: "uint256" }] },
  { name: "setFee",             type: "function", stateMutability: "nonpayable",  inputs: [{ name: "feeBps_", type: "uint256" }],                                                                              outputs: [] },
  { name: "transferAdmin",      type: "function", stateMutability: "nonpayable",  inputs: [{ name: "newAdmin", type: "address" }],                                                                             outputs: [] },
  { name: "seed",               type: "function", stateMutability: "nonpayable",  inputs: [{ name: "projectId", type: "uint256" }, { name: "usdcIn", type: "uint256" }, { name: "commitIn", type: "uint256" }], outputs: [] },
  { name: "removeLiquidity",    type: "function", stateMutability: "nonpayable",  inputs: [{ name: "projectId", type: "uint256" }],                                                                             outputs: [] },
  { name: "swapUsdcForCommit",  type: "function", stateMutability: "nonpayable",  inputs: [{ name: "projectId", type: "uint256" }, { name: "usdcIn",    type: "uint256" }, { name: "minCommitOut", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "swapCommitForUsdc",  type: "function", stateMutability: "nonpayable",  inputs: [{ name: "projectId", type: "uint256" }, { name: "commitIn",  type: "uint256" }, { name: "minUsdcOut",   type: "uint256" }], outputs: [{ type: "uint256" }] },
  /* ─── events ─── */
  {
    name: "Swap", type: "event",
    inputs: [
      { name: "projectId", type: "uint256", indexed: true  },
      { name: "user",      type: "address", indexed: true  },
      { name: "tokenIn",   type: "address", indexed: false },
      { name: "amountIn",  type: "uint256", indexed: false },
      { name: "tokenOut",  type: "address", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  { name: "balanceOf",  type: "function", stateMutability: "view",       inputs: [{ name: "account", type: "address" }],                                              outputs: [{ type: "uint256" }] },
  { name: "allowance",  type: "function", stateMutability: "view",       inputs: [{ name: "owner",   type: "address" }, { name: "spender", type: "address" }],        outputs: [{ type: "uint256" }] },
  { name: "approve",    type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount",  type: "uint256" }],        outputs: [{ type: "bool"    }] },
] as const;

export const ERC1155_ABI = [
  { name: "balanceOf",        type: "function", stateMutability: "view",       inputs: [{ name: "account",   type: "address" }, { name: "id",       type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "isApprovedForAll", type: "function", stateMutability: "view",       inputs: [{ name: "account",   type: "address" }, { name: "operator", type: "address" }], outputs: [{ type: "bool"    }] },
  { name: "setApprovalForAll",type: "function", stateMutability: "nonpayable", inputs: [{ name: "operator",  type: "address" }, { name: "approved", type: "bool"    }], outputs: [] },
] as const;

export const VAULT_ABI = [
  { name: "isAdmin",      type: "function", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "bool" }] },
  { name: "admin",        type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "pendingAdmin", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "projectCount", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "totalRaised",  type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "projectSubmissionFee", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "releaseFeeBps", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "revenueRouter", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "lender", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "oracle", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "approvedZK", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ type: "bool" }] },
  { name: "setSubmissionFee", type: "function", stateMutability: "nonpayable", inputs: [{ name: "fee", type: "uint256" }], outputs: [] },
  { name: "setReleaseFeeBps", type: "function", stateMutability: "nonpayable", inputs: [{ name: "bps", type: "uint256" }], outputs: [] },
  { name: "setRevenueRouter", type: "function", stateMutability: "nonpayable", inputs: [{ name: "revenueRouter_", type: "address" }], outputs: [] },
  { name: "setLender", type: "function", stateMutability: "nonpayable", inputs: [{ name: "lender_", type: "address" }], outputs: [] },
  { name: "setOracle", type: "function", stateMutability: "nonpayable", inputs: [{ name: "oracle_", type: "address" }], outputs: [] },
  { name: "addZK", type: "function", stateMutability: "nonpayable", inputs: [{ name: "zk_", type: "address" }], outputs: [] },
  { name: "removeZK", type: "function", stateMutability: "nonpayable", inputs: [{ name: "zk_", type: "address" }], outputs: [] },
  { name: "transferAdmin", type: "function", stateMutability: "nonpayable", inputs: [{ name: "newAdmin", type: "address" }], outputs: [] },
  { name: "approveProject", type: "function", stateMutability: "nonpayable", inputs: [{ name: "projectId", type: "uint256" }], outputs: [] },
  {
    name: "invest",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "projectId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "createProject",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "treasury_", type: "address" },
      { name: "milestoneCount_", type: "uint256" },
      { name: "name_", type: "string" },
      { name: "description_", type: "string" },
      { name: "additionalFilesUrl_", type: "string" },
      { name: "metadataUri_", type: "string" },
      { name: "fundingGoal_", type: "uint256" },
      { name: "fundingDeadline_", type: "uint256" },
    ],
    outputs: [{ name: "projectId", type: "uint256" }],
  },
  {
    name: "projects", type: "function", stateMutability: "view",
    inputs: [{ name: "projectId", type: "uint256" }],
    outputs: [
      { name: "founder",            type: "address"  },
      { name: "treasury",           type: "address"  },
      { name: "milestoneCount",     type: "uint256"  },
      { name: "totalRaised",        type: "uint256"  },
      { name: "totalReleased",      type: "uint256"  },
      { name: "currentMilestone",   type: "uint256"  },
      { name: "releaseRequestedAt", type: "uint256"  },
      { name: "releaseVetoed",      type: "bool"     },
      { name: "metadataUri",        type: "string"   },
      { name: "fundingGoal",        type: "uint256"  },
      { name: "fundingDeadline",    type: "uint256"  },
      { name: "approved",           type: "bool"     },
      { name: "name",               type: "string"   },
      { name: "description",        type: "string"   },
      { name: "additionalFilesUrl", type: "string"   },
    ],
  },
  {
    name: "getCommitmentBreakdown", type: "function", stateMutability: "view",
    inputs: [
      { name: "user",   type: "address" },
      { name: "offset", type: "uint256" },
      { name: "limit",  type: "uint256" },
    ],
    outputs: [
      { name: "projectIds", type: "uint256[]" },
      { name: "amounts",    type: "uint256[]" },
    ],
  },
  { name: "claimableYield", type: "function", stateMutability: "view",       inputs: [{ name: "user",      type: "address" }],                                                        outputs: [{ type: "uint256" }] },
  { name: "yieldIndex",     type: "function", stateMutability: "view",       inputs: [],                                                                                              outputs: [{ type: "uint256" }] },
  { name: "claimYield",     type: "function", stateMutability: "nonpayable", inputs: [],                                                                                              outputs: [] },
  { name: "veto",           type: "function", stateMutability: "nonpayable", inputs: [{ name: "projectId", type: "uint256" }],                                                        outputs: [] },
  { name: "hasVoted",       type: "function", stateMutability: "view",       inputs: [{ name: "projectId", type: "uint256" }, { name: "user", type: "address" }],                     outputs: [{ type: "bool"    }] },
  { name: "vetoVotes",      type: "function", stateMutability: "view",       inputs: [{ name: "projectId", type: "uint256" }],                                                        outputs: [{ type: "uint256" }] },
  /* ─── events ─── */
  {
    name: "Invested", type: "event",
    inputs: [
      { name: "projectId", type: "uint256", indexed: true  },
      { name: "investor",  type: "address", indexed: true  },
      { name: "amount",    type: "uint256", indexed: false },
    ],
  },
  {
    name: "YieldClaimed", type: "event",
    inputs: [
      { name: "user",   type: "address", indexed: true  },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
