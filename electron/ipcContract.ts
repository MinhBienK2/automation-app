import type { WorkflowElectronBridge } from "../src/types/electron.js";
import type { WorkflowCommandHandlers } from "./backend/commands.js";
import type { WorkflowIpcChannelName } from "./ipc.js";

/**
 * The IPC command boundary stated as a type-level contract.
 *
 * A command name is currently written out in four places — the channel map, the
 * backend handler set, the bridge type, and the preload forwarder. Three of the
 * four are already in exact correspondence, but only by everyone having been
 * careful; nothing declared the invariant, so the correspondence was not a
 * guarantee. Where a mismatch did fail the build it did so obliquely: omitting a
 * handler produced `TS7053: Element implicitly has an 'any' type`, from the
 * indexed access in the main-process registration loop, rather than saying a
 * handler was missing.
 *
 * These assertions state each direction and name the offending command. Nothing
 * imports them for their value — they exist to fail `tsc`.
 */

/**
 * Commands the backend exposes deliberately without an IPC channel: they are
 * invoked in-process by the main process or by other handlers, never by the
 * renderer. Adding a handler without a channel is fine, but it has to be a
 * conscious act — list it here or the build fails.
 */
type InternalOnlyCommand =
  | "runSchedulerTick"
  | "ensureProjectModelReady"
  | "checkAndRunAutomaticBackup"
  | "_startWorkflowRun"
  | "_validateWorkflowRun";

/** Every channel must have a backend handler, or it fails at run time with "handler is not a function". */
type AssertEveryChannelHasAHandler<
  ChannelsWithoutAHandler extends never = Exclude<
    WorkflowIpcChannelName,
    keyof WorkflowCommandHandlers
  >,
> = ChannelsWithoutAHandler;

/** Every backend handler must have a channel or be declared internal-only, or it is unreachable. */
type AssertEveryHandlerHasAChannel<
  HandlersWithoutAChannel extends never = Exclude<
    keyof WorkflowCommandHandlers,
    WorkflowIpcChannelName | InternalOnlyCommand
  >,
> = HandlersWithoutAChannel;

/** Every channel must have a bridge signature, or the renderer cannot reach it. */
type AssertEveryChannelHasABridgeMethod<
  ChannelsWithoutABridgeMethod extends never = Exclude<
    WorkflowIpcChannelName,
    keyof WorkflowElectronBridge
  >,
> = ChannelsWithoutABridgeMethod;

/** Every bridge signature must have a channel, or it can never be invoked. */
type AssertEveryBridgeMethodHasAChannel<
  BridgeMethodsWithoutAChannel extends never = Exclude<
    keyof WorkflowElectronBridge,
    WorkflowIpcChannelName
  >,
> = BridgeMethodsWithoutAChannel;

export type WorkflowIpcContract = [
  AssertEveryChannelHasAHandler,
  AssertEveryHandlerHasAChannel,
  AssertEveryChannelHasABridgeMethod,
  AssertEveryBridgeMethodHasAChannel,
];
