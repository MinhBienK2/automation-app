# Scheduling and Batch on the Desktop Surface

Whether a desktop workflow may run unattended, and what happens when two want the same application. Resolves [#53](https://github.com/MinhBienK2/automation-app/issues/53).

## The difference that drives everything here

A web run is invisible. It happens in a browser the operator never sees, and "runs in the background" is literally true.

A desktop run **opens an application on the screen the operator is looking at**. Input-device isolation — the thing that makes this project's approach work — solves half the problem and not the other half: the mouse and keyboard stay the operator's, but the window still appears, can take focus, and covers what they were reading.

So the honest framing is that desktop runs are *unattended*, not *background*. Everything below follows from refusing to blur that.

## Desktop workflows are schedulable, with the warning stated where it lands

Scheduling is allowed. Forbidding it would be a bigger loss than the interruption is a cost, and the operator is better placed than we are to know whether 09:00 is a good time for their ledger application to open.

The warning is shown **in the schedule dialog**, at the moment a time is chosen — not in documentation, and not as a run-time surprise. It names the application, says the window will appear, says the input devices stay theirs, and says plainly that overnight running is unproven.

## Conflict on a Desktop Target is a skip, not a queue

Two schedules pointed at one Desktop Target cannot both run: they would interleave keystrokes into the same windows.

The options were skip, queue, or fail. **Skip**, and it is not merely the convenient answer:

- **Queueing is worse than not running.** A queued desktop run means an application window opening on the operator's screen at an unpredictable later moment, with no relationship to the time they chose. The whole point of picking 09:00 was that 09:00 was acceptable.
- **Failing is too loud.** A schedule that reports failure every time its target happens to be busy fills the run history with events that are not problems.

A skip is recorded with its reason through the scheduler's existing `skipped` event, so it is visible rather than silent. This needed no new machinery: the Desktop Target simply joins the existing conflict check, alongside the workflow and the browser profile.

## Batch closes the application between rows

Batch runs already force `browser_retention: "close"`, and on this surface that setting means `kill_app` between rows. It is the right default here for a reason specific to desktop: `launch_app` is **not** clean-slate — a measured launch of Notepad restored the operator's previous tabs — so state carried between rows would compound a leak that already exists within a single run.

Keeping the application open between rows would be faster. It would also mean row 40 running against whatever rows 1–39 left behind, with no way for the workflow author to tell. The cost is paid in seconds; the alternative is paid in a batch whose later rows are quietly not reproducible.

Applications the run **attached** to rather than launched are never terminated, between rows or at the end. The run did not start them and cannot know what else they hold.

## Settled: a locked workstation still works

Measured on Windows 11 on 2026-08-15, and the answer is yes.

The full slice — launch Character Map, snapshot it, click an element, type into it, read the value back — ran on a loop across a lock and an unlock. Thirteen consecutive runs completed while `LogonUI.exe` was present, every one of them `success` with the expected value read back, and not one behaved differently from the unlocked runs either side of it.

That makes sense once stated: the lock screen lives on the `Winlogon` desktop, and the application's window is still on the user's own desktop underneath it. UIA is reading the window, not the screen. It is also why this had to be measured rather than reasoned about — the same fact could equally have implied the opposite.

So **overnight scheduling is viable**, and desktop automation is not a working-hours-only feature.

Two things this does *not* say, and the dialog should not either:

- **A signed-out or restarted machine is a different question.** The session must still exist. Locked is not logged out.
- **Nothing was measured about a screensaver, sleep, or hibernation.** The measurement covers `Win+L`, which is the case an operator actually chooses when they leave the desk.

What it changes for the operator: the schedule dialog no longer needs to warn that overnight running is unproven. It still warns that the window will appear on the screen — which is the other half of the problem, and the half locking does not solve, because the window is there again the moment they unlock.

## What did not change

Concurrency stays at one. Batch already refuses `concurrency > 1`, and desktop gives no reason to revisit that — the reason for the limit on the web side was resource contention, and on this side there is a stronger one in the shape of a single screen.
