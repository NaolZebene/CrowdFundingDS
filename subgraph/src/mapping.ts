import { Address, BigDecimal, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  FundsReleased,
  Invested,
  MilestoneVerified,
  ProjectApproved,
  ProjectCreated,
  ProjectRegistered,
  Refunded,
  ReleaseRequested,
  VetoCleared,
  VetoedEvent,
  YieldClaimed,
} from "../generated/CrowdVault/CrowdVault";
import {
  FeeSet,
  LiquidityRemoved,
  Seeded,
  Swap as SwapEvent,
} from "../generated/CommitmentAMM/CommitmentAMM";
import {
  Investment,
  Pool,
  PoolDayData,
  PoolHourData,
  Project,
  ProjectUser,
  Swap,
  VetoVote,
  YieldClaim,
} from "../generated/schema";

const USDC_DECIMALS = 6;
const COMMIT_DECIMALS = 6;
const ZERO_BI = BigInt.fromI32(0);
const ONE_BI = BigInt.fromI32(1);
const ZERO_BD = BigDecimal.fromString("0");
const DEFAULT_FEE_BPS = BigInt.fromI32(30);
const USDC_ADDRESS = "0x3459109957cd4bdc19f100ed9d6d703329b26cae";

function exp10(decimals: i32): BigInt {
  let result = ONE_BI;
  for (let i = 0; i < decimals; i++) {
    result = result.times(BigInt.fromI32(10));
  }
  return result;
}

function toDecimal(v: BigInt, decimals: i32): BigDecimal {
  return v.toBigDecimal().div(exp10(decimals).toBigDecimal());
}

function eventId(hash: Bytes, logIndex: BigInt): string {
  return hash.toHexString() + "-" + logIndex.toString();
}

function projectIdStr(projectId: BigInt): string {
  return projectId.toString();
}

function projectUserId(projectId: BigInt, user: Address): string {
  return projectId.toString() + "-" + user.toHexString();
}

function hourStart(timestamp: BigInt): i32 {
  const t = timestamp.toI32();
  return (t / 3600) * 3600;
}

function dayStart(timestamp: BigInt): i32 {
  const t = timestamp.toI32();
  return (t / 86400) * 86400;
}

function maxBd(a: BigDecimal, b: BigDecimal): BigDecimal {
  return a.gt(b) ? a : b;
}

function minBd(a: BigDecimal, b: BigDecimal): BigDecimal {
  return a.lt(b) ? a : b;
}

function safeSub(a: BigInt, b: BigInt): BigInt {
  return a.ge(b) ? a.minus(b) : ZERO_BI;
}

function getOrCreateProject(projectId: BigInt, timestamp: BigInt, block: BigInt): Project {
  const id = projectIdStr(projectId);
  let project = Project.load(id);
  if (!project) {
    project = new Project(id);
    project.projectId = projectId;
    project.founder = Address.zero();
    project.treasury = Address.zero();
    project.milestoneCount = ZERO_BI;
    project.name = "";
    project.description = "";
    project.additionalFilesUrl = "";
    project.metadataUri = "";
    project.totalRaised = ZERO_BI;
    project.totalReleased = ZERO_BI;
    project.currentMilestone = ZERO_BI;
    project.approved = false;
    project.createdAt = timestamp;
    project.createdAtBlock = block;
    project.updatedAt = timestamp;
    project.updatedAtBlock = block;
    project.save();
  }
  return project as Project;
}

function getOrCreateProjectUser(
  projectId: BigInt,
  user: Address,
  timestamp: BigInt,
): ProjectUser {
  const id = projectUserId(projectId, user);
  let relation = ProjectUser.load(id);
  if (!relation) {
    relation = new ProjectUser(id);
    relation.project = projectIdStr(projectId);
    relation.projectId = projectId;
    relation.user = user;
    relation.investedUsdc = ZERO_BI;
    relation.claimedYieldUsdc = ZERO_BI;
    relation.hasVotedVeto = false;
    relation.firstSeenAt = timestamp;
    relation.lastSeenAt = timestamp;
  }
  relation.lastSeenAt = timestamp;
  relation.save();
  return relation as ProjectUser;
}

function getOrCreatePool(projectId: BigInt, timestamp: BigInt, block: BigInt): Pool {
  const id = projectIdStr(projectId);
  let pool = Pool.load(id);
  if (!pool) {
    pool = new Pool(id);
    pool.project = id;
    pool.projectId = projectId;
    pool.reserveUsdc = ZERO_BI;
    pool.reserveCommit = ZERO_BI;
    pool.seeded = false;
    pool.feeBps = DEFAULT_FEE_BPS;
    pool.lastPrice = ZERO_BD;
    pool.volumeUsdc = ZERO_BD;
    pool.volumeCommit = ZERO_BD;
    pool.swapCount = ZERO_BI;
    pool.updatedAt = timestamp;
    pool.updatedAtBlock = block;
    pool.save();
  }
  return pool as Pool;
}

function getOrCreateHourData(pool: Pool, timestamp: BigInt, price: BigDecimal): PoolHourData {
  const start = hourStart(timestamp);
  const id = pool.id + "-" + start.toString();
  let candle = PoolHourData.load(id);
  if (!candle) {
    candle = new PoolHourData(id);
    candle.pool = pool.id;
    candle.projectId = pool.projectId;
    candle.periodStartUnix = start;
    candle.open = price;
    candle.high = price;
    candle.low = price;
    candle.close = price;
    candle.volumeUsdc = ZERO_BD;
    candle.volumeCommit = ZERO_BD;
    candle.txCount = ZERO_BI;
  }
  return candle as PoolHourData;
}

function getOrCreateDayData(pool: Pool, timestamp: BigInt, price: BigDecimal): PoolDayData {
  const start = dayStart(timestamp);
  const id = pool.id + "-" + start.toString();
  let candle = PoolDayData.load(id);
  if (!candle) {
    candle = new PoolDayData(id);
    candle.pool = pool.id;
    candle.projectId = pool.projectId;
    candle.periodStartUnix = start;
    candle.open = price;
    candle.high = price;
    candle.low = price;
    candle.close = price;
    candle.volumeUsdc = ZERO_BD;
    candle.volumeCommit = ZERO_BD;
    candle.txCount = ZERO_BI;
  }
  return candle as PoolDayData;
}

function updateProjectTimestamp(project: Project, ts: BigInt, block: BigInt): void {
  project.updatedAt = ts;
  project.updatedAtBlock = block;
}

export function handleProjectCreated(event: ProjectCreated): void {
  const project = getOrCreateProject(
    event.params.projectId,
    event.block.timestamp,
    event.block.number,
  );
  project.founder = event.params.founder;
  project.treasury = event.params.treasury;
  project.milestoneCount = event.params.milestoneCount;
  project.metadataUri = event.params.metadataUri;
  project.name = event.params.name;
  project.description = event.params.description;
  project.additionalFilesUrl = event.params.additionalFilesUrl;
  updateProjectTimestamp(project, event.block.timestamp, event.block.number);
  project.save();

  getOrCreatePool(event.params.projectId, event.block.timestamp, event.block.number);
}

export function handleProjectApproved(event: ProjectApproved): void {
  const project = getOrCreateProject(
    event.params.projectId,
    event.block.timestamp,
    event.block.number,
  );
  project.approved = true;
  updateProjectTimestamp(project, event.block.timestamp, event.block.number);
  project.save();
}

export function handleProjectRegistered(event: ProjectRegistered): void {
  getOrCreateProject(event.params.projectId, event.block.timestamp, event.block.number);
  getOrCreateProjectUser(event.params.projectId, event.params.user, event.block.timestamp);
}

export function handleInvested(event: Invested): void {
  const project = getOrCreateProject(
    event.params.projectId,
    event.block.timestamp,
    event.block.number,
  );
  project.totalRaised = project.totalRaised.plus(event.params.amount);
  updateProjectTimestamp(project, event.block.timestamp, event.block.number);
  project.save();

  const relation = getOrCreateProjectUser(
    event.params.projectId,
    event.params.investor,
    event.block.timestamp,
  );
  relation.investedUsdc = relation.investedUsdc.plus(event.params.amount);
  relation.save();

  const invested = new Investment(eventId(event.transaction.hash, event.logIndex));
  invested.txHash = event.transaction.hash;
  invested.logIndex = event.logIndex;
  invested.project = project.id;
  invested.projectId = event.params.projectId;
  invested.investor = event.params.investor;
  invested.amount = event.params.amount;
  invested.timestamp = event.block.timestamp;
  invested.blockNumber = event.block.number;
  invested.save();
}

export function handleRefunded(event: Refunded): void {
  const project = getOrCreateProject(
    event.params.projectId,
    event.block.timestamp,
    event.block.number,
  );
  project.totalRaised = safeSub(project.totalRaised, event.params.amount);
  updateProjectTimestamp(project, event.block.timestamp, event.block.number);
  project.save();

  const relation = getOrCreateProjectUser(
    event.params.projectId,
    event.params.investor,
    event.block.timestamp,
  );
  relation.investedUsdc = safeSub(relation.investedUsdc, event.params.amount);
  relation.save();
}

export function handleMilestoneVerified(event: MilestoneVerified): void {
  const project = getOrCreateProject(
    event.params.projectId,
    event.block.timestamp,
    event.block.number,
  );
  project.currentMilestone = event.params.milestone;
  updateProjectTimestamp(project, event.block.timestamp, event.block.number);
  project.save();
}

export function handleReleaseRequested(event: ReleaseRequested): void {
  const project = getOrCreateProject(
    event.params.projectId,
    event.block.timestamp,
    event.block.number,
  );
  updateProjectTimestamp(project, event.block.timestamp, event.block.number);
  project.save();
}

export function handleFundsReleased(event: FundsReleased): void {
  const project = getOrCreateProject(
    event.params.projectId,
    event.block.timestamp,
    event.block.number,
  );
  project.totalReleased = project.totalReleased.plus(event.params.amount);
  project.currentMilestone = event.params.milestone;
  updateProjectTimestamp(project, event.block.timestamp, event.block.number);
  project.save();
}

export function handleVetoedEvent(event: VetoedEvent): void {
  const project = getOrCreateProject(
    event.params.projectId,
    event.block.timestamp,
    event.block.number,
  );
  updateProjectTimestamp(project, event.block.timestamp, event.block.number);
  project.save();

  const relation = getOrCreateProjectUser(
    event.params.projectId,
    event.params.by,
    event.block.timestamp,
  );
  relation.hasVotedVeto = true;
  relation.save();

  const vote = new VetoVote(eventId(event.transaction.hash, event.logIndex));
  vote.txHash = event.transaction.hash;
  vote.logIndex = event.logIndex;
  vote.project = project.id;
  vote.projectId = event.params.projectId;
  vote.voter = event.params.by;
  vote.timestamp = event.block.timestamp;
  vote.blockNumber = event.block.number;
  vote.save();
}

export function handleVetoCleared(event: VetoCleared): void {
  const project = getOrCreateProject(
    event.params.projectId,
    event.block.timestamp,
    event.block.number,
  );
  updateProjectTimestamp(project, event.block.timestamp, event.block.number);
  project.save();
}

export function handleYieldClaimed(event: YieldClaimed): void {
  const claimed = new YieldClaim(eventId(event.transaction.hash, event.logIndex));
  claimed.txHash = event.transaction.hash;
  claimed.logIndex = event.logIndex;
  claimed.user = event.params.user;
  claimed.amount = event.params.amount;
  claimed.timestamp = event.block.timestamp;
  claimed.blockNumber = event.block.number;
  claimed.save();
}

export function handleSeeded(event: Seeded): void {
  const project = getOrCreateProject(
    event.params.projectId,
    event.block.timestamp,
    event.block.number,
  );
  const pool = getOrCreatePool(event.params.projectId, event.block.timestamp, event.block.number);
  pool.reserveUsdc = event.params.usdcIn;
  pool.reserveCommit = event.params.commitIn;
  pool.seeded = true;
  if (event.params.commitIn.gt(ZERO_BI)) {
    pool.lastPrice = toDecimal(event.params.usdcIn, USDC_DECIMALS).div(
      toDecimal(event.params.commitIn, COMMIT_DECIMALS),
    );
  }
  pool.updatedAt = event.block.timestamp;
  pool.updatedAtBlock = event.block.number;
  pool.save();

  updateProjectTimestamp(project, event.block.timestamp, event.block.number);
  project.save();
}

export function handleLiquidityRemoved(event: LiquidityRemoved): void {
  const pool = getOrCreatePool(event.params.projectId, event.block.timestamp, event.block.number);
  pool.reserveUsdc = ZERO_BI;
  pool.reserveCommit = ZERO_BI;
  pool.seeded = false;
  pool.updatedAt = event.block.timestamp;
  pool.updatedAtBlock = event.block.number;
  pool.save();
}

export function handleFeeSet(event: FeeSet): void {
  // FeeSet is global; mirror it into all pools lazily when next swap/seed hits.
  // This handler exists so the event remains indexed for future extensions.
  const _ = event.params.feeBps;
}

export function handleSwap(event: SwapEvent): void {
  const project = getOrCreateProject(
    event.params.projectId,
    event.block.timestamp,
    event.block.number,
  );
  const pool = getOrCreatePool(event.params.projectId, event.block.timestamp, event.block.number);

  const tokenIn = event.params.tokenIn.toHexString().toLowerCase();
  const tokenOut = event.params.tokenOut.toHexString().toLowerCase();
  const usdcIn = tokenIn == USDC_ADDRESS;
  const usdcOut = tokenOut == USDC_ADDRESS;

  const usdcAmountRaw = usdcIn ? event.params.amountIn : event.params.amountOut;
  const commitAmountRaw = usdcIn ? event.params.amountOut : event.params.amountIn;
  const usdcAmount = toDecimal(usdcAmountRaw, USDC_DECIMALS);
  const commitAmount = toDecimal(commitAmountRaw, COMMIT_DECIMALS);
  const price = commitAmount.gt(ZERO_BD)
    ? usdcAmount.div(commitAmount)
    : pool.lastPrice;

  if (usdcIn) {
    pool.reserveUsdc = pool.reserveUsdc.plus(event.params.amountIn);
    pool.reserveCommit = safeSub(pool.reserveCommit, event.params.amountOut);
  } else {
    pool.reserveCommit = pool.reserveCommit.plus(event.params.amountIn);
    pool.reserveUsdc = safeSub(pool.reserveUsdc, event.params.amountOut);
  }
  pool.lastPrice = price;
  pool.volumeUsdc = pool.volumeUsdc.plus(usdcAmount);
  pool.volumeCommit = pool.volumeCommit.plus(commitAmount);
  pool.swapCount = pool.swapCount.plus(ONE_BI);
  pool.updatedAt = event.block.timestamp;
  pool.updatedAtBlock = event.block.number;
  pool.save();

  const hour = getOrCreateHourData(pool, event.block.timestamp, price);
  hour.high = maxBd(hour.high, price);
  hour.low = minBd(hour.low, price);
  hour.close = price;
  hour.volumeUsdc = hour.volumeUsdc.plus(usdcAmount);
  hour.volumeCommit = hour.volumeCommit.plus(commitAmount);
  hour.txCount = hour.txCount.plus(ONE_BI);
  hour.save();

  const day = getOrCreateDayData(pool, event.block.timestamp, price);
  day.high = maxBd(day.high, price);
  day.low = minBd(day.low, price);
  day.close = price;
  day.volumeUsdc = day.volumeUsdc.plus(usdcAmount);
  day.volumeCommit = day.volumeCommit.plus(commitAmount);
  day.txCount = day.txCount.plus(ONE_BI);
  day.save();

  const swap = new Swap(eventId(event.transaction.hash, event.logIndex));
  swap.txHash = event.transaction.hash;
  swap.logIndex = event.logIndex;
  swap.project = project.id;
  swap.pool = pool.id;
  swap.projectId = event.params.projectId;
  swap.user = event.params.user;
  swap.tokenIn = event.params.tokenIn;
  swap.tokenOut = event.params.tokenOut;
  swap.amountIn = event.params.amountIn;
  swap.amountOut = event.params.amountOut;
  swap.amountInUsdc = usdcIn ? toDecimal(event.params.amountIn, USDC_DECIMALS) : ZERO_BD;
  swap.amountOutUsdc = usdcOut ? toDecimal(event.params.amountOut, USDC_DECIMALS) : ZERO_BD;
  swap.priceUsdcPerCommit = price;
  swap.side = usdcIn ? "BUY" : "SELL";
  swap.timestamp = event.block.timestamp;
  swap.blockNumber = event.block.number;
  swap.save();

  updateProjectTimestamp(project, event.block.timestamp, event.block.number);
  project.save();
}
