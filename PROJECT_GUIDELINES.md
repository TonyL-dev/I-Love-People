# I Love People

## Product direction

I Love People is an iPhone app that helps you remember when you last saw someone and make time to see them again. It is for people who care about staying close to friends, family, and others but lose track of time between get-togethers.

The first version should make three things easy: add someone, log when you saw them, and get a reminder when you’d like to see them again. The feature ideas below are a backlog. The first-release section defines the proposed starting scope.

## Product guidelines

- **Let people set their own pace.** Users decide who to track, how often they want to meet, and whether a reminder is helpful. Use gentle language such as “It’s been a while since you saw Maya.”
- **Make logging quick.** From a person’s profile, a user should be able to log a meetup for today in one tap. Let them backdate it, edit it, or undo it. Keep notes and other details optional.
- **Keep meetups, plans, and messages distinct.** A plan records intent. An invitation records outreach. A completed meetup updates the last-seen date. If other forms of contact are added later, show what actually happened and let the user decide what counts toward their cadence.
- **Give reminders a clear reason.** Show the last meetup and the user’s chosen cadence. Let people snooze, dismiss, or pause reminders without changing their meetup history.
- **Keep personal data private by default.** Start with manual entry and on-device storage. Ask for access to contacts, calendars, or photos only when the user chooses a feature that needs it. Make lock-screen wording and data export deliberate choices.
- **Design for one-handed use and accessibility.** Keep frequent actions within easy reach. Support Dynamic Type, VoiceOver, and clear labels for states such as due, snoozed, and paused.

## Proposed first release

1. **Add a person.** Enter a name, optionally enter when you last saw them, and choose a cadence or leave reminders off. A person can be added with only a name.
2. **See who’s coming up.** Show people who are due soon or due now, with the last-seen date and the next reminder date. Show an explicit “No meetup logged” state when the date is unknown.
3. **Log a meetup.** Record today’s date from the person’s profile or choose a previous date. Show the history and let the user correct or delete entries.
4. **Get a gentle nudge.** Schedule a local notification from the latest recorded meetup and the chosen cadence. Open the relevant profile from the notification and offer quick snooze and pause controls in the app.
5. **Manage the list.** Search, edit, archive, and delete people. Keep history for archived profiles and cancel their pending reminders.

**Example.** You last saw Maya on October 10 and want to see her about every four weeks. The next nudge is due November 7. Snoozing moves the notification while keeping October 10 as the last meetup. If you log a meetup for November 9, the next nudge is due December 7. Adding an older meetup fills in the history without moving the nudge.

### First-release behavior to verify

- A newly added person with no meetup date stays in the “No meetup logged” state. The first release uses a real meetup date to start a recurring cadence.
- Editing or deleting the latest meetup recalculates the next nudge from the latest remaining meetup. Removing the last meetup returns the profile to the unknown-date state and clears its pending reminder.
- Changing a cadence, pausing reminders, archiving a profile, or deleting it updates or clears any pending notification for that person. A new meetup replaces a pending snooze with the next cadence-based date.
- Turning off notifications still leaves due dates visible in the app. The app can be used offline.

## Meetup priority

Let users set an optional, private priority for each person with the prompt “How much of a priority is it to see them right now?” The level helps decide who to make plans with first. Someone can be a high priority because they’re visiting soon or because you want to reconnect, regardless of how often you usually see them.

| Level | When to use it | Suggested cadence |
| --- | --- | --- |
| Closest | I want to make time for them regularly. | Every 2 weeks |
| Close | I want to see them fairly often. | Every month |
| Comme ci, comme ça | I’d like to see them occasionally. | Every 3 months |
| Distant | I’d like to catch up once in a while. | Every 6 months |

### How it works

- **Make the level optional.** Offer it when adding or editing a person. Start with no level selected, and let users change or clear it whenever their priorities shift.
- **Keep priority and cadence independently editable.** Selecting a level offers its suggested cadence for the user to accept. Changing a level keeps the existing cadence and reminder settings unless the user explicitly updates them. A user can rank someone highly and leave reminders off.
- **Group by timing, then sort by priority.** Show people due now before people due soon. Within each group, show higher priorities first, place unranked people after ranked people, and break ties by earliest due date, then name. Offer a separate “Priority” sort in the full people list for planning ahead.
- **Keep reminders tied to dates.** A higher level moves someone up within their group. Sending a nudge still depends on their cadence and reminder settings.
- **Keep labels private.** Show priority levels inside the app. Leave them out of notification text, invitation drafts, and shared views.
- **Use words in the interface.** Show the level name and a short description in the picker. Keep the full label readable with large text and VoiceOver.

**Example.** Maya is Closest and due next week. Jo is Close and due today, so Jo appears first in the due view. Once both are due, Maya appears first. If Maya moves away, you can keep her at Closest and switch her cadence to every six months.

## Feature backlog

### People and organization

- **Selective contact import.** Pick specific people from iPhone Contacts and choose which fields to copy.
- **Contact shortcuts.** Link a profile to a contact card for calls or texts when the user wants to reach out.
- **Profile photos and initials.** Make it easier to recognize people when scanning the list.
- **Preferred names and pronunciation.** Save nicknames, pronouns, or a pronunciation hint when useful.
- **Custom groups.** Organize people by family, friends, former coworkers, neighbors, or any labels that fit.
- **Pinned people.** Keep a few frequently accessed profiles at the top.
- **Households.** Link related profiles for easy lookup and shared meetup logging.
- **Location tags.** Group people by city or neighborhood for trip and meetup planning.
- **Custom sorting and filters.** Browse by name, meetup priority, last meetup, next nudge, city, or group.
- **Duplicate merging.** Combine two profiles with a preview of their meetup history and a choice of reminder settings.

### Meetup history

- **Multi-person logging.** Record a dinner or group outing once and update the history for everyone who attended.
- **Meetup types.** Distinguish coffee, walks, meals, visits, activities, and video calls with optional labels.
- **Other kinds of contact.** Track calls, texts, or letters separately and optionally count selected types toward a person’s cadence.
- **Approximate dates.** Let someone record “around May” or “last summer” and show any reminder estimate as approximate.
- **Time and duration.** Keep optional details about when a meetup started and how long it lasted.
- **Meetup notes.** Save a short recap, something to follow up on, or a detail to remember for next time.
- **Places and venues.** Remember where you met and reuse the venue when planning another meetup.
- **Photos and links.** Attach an optional photo, shared album link, or event link to an entry.
- **History search.** Find a specific meetup by person, place, label, or note.
- **Recent meetup batch entry.** Add several recent meetups while catching up after a busy week or trip.
- **Same-day entry review.** Flag a possible duplicate and let the user keep both when they actually met twice.

### Cadence and reminders

- **Cadence presets.** Offer weekly, every two weeks, monthly, quarterly, and yearly options alongside custom intervals.
- **Group defaults.** Suggest a cadence when adding someone to a group and allow per-person changes.
- **Flexible windows.** Let users aim to meet in a range such as every four to six weeks.
- **Seasonal cadences.** Schedule different meetup goals around school terms, travel, or seasonal activities.
- **First check-in date.** Allow a one-off nudge for someone whose last meetup date is unknown.
- **One-off follow-up.** Remind the user to follow up after a specific conversation, event, or life change.
- **Preferred reminder times.** Let users choose days, time windows, or a weekly review time.
- **Quiet hours and reminder limits.** Defer notifications during busy periods and bundle them when several people are due.
- **Weekly digest.** Show upcoming nudges and recent meetups in one optional notification or in-app view.
- **Quick notification actions.** Open the profile, snooze, or log a meetup with a way to undo an accidental tap.
- **Pause until a date.** Resume reminders automatically after a vacation, move, or busy season.
- **Vacation mode.** Pause reminders across the app and let the user review accumulated nudges when they return.
- **Upcoming-plan awareness.** Offer to defer a nudge when a meetup is already on the calendar and check in after the event.
- **Reminder history.** Show when a reminder was scheduled, snoozed, or dismissed so users can see why the next one is due.
- **Birthdays and anniversaries.** Offer separate, optional reminders for dates the user wants to remember.

### Planning the next meetup

- **Plan from a profile.** Move from a nudge to a tentative activity, date, and place.
- **Ideas per person.** Save places to go, activities to try, or invitations you’d like to extend.
- **Preferred times and activities.** Remember details such as “weekend walks” or “coffee near work.”
- **Editable invitation drafts.** Prepare a message with the person’s name and proposed times, then open it for the user to review and send.
- **Availability preview.** With permission, show open blocks on the user’s chosen calendars while planning.
- **Calendar handoff.** Create a calendar event from a plan and let the user review the event and any invitees.
- **Plan status.** Track tentative, scheduled, rescheduled, canceled, and completed meetups.
- **Post-event check-in.** Ask whether a scheduled meetup happened and let the user confirm or correct the details.
- **Group outings.** Build a plan for several people and log only those who actually attended.
- **Trip planning.** Pick a destination and date range to see people nearby and build a shortlist of possible meetups.
- **Opt-in location suggestions.** Surface people tagged in the city the user is visiting, with a manual city picker available.
- **Follow-up prompts.** Set a personal reminder to share a photo, return an item, send a link, or pick a new date.

### Personal context and reflection

- **Private profile notes.** Keep details you’d like to remember before the next meetup.
- **Conversation topics.** Save questions to ask or topics to revisit next time.
- **Shared interests.** Track hobbies and activities you enjoy together for future planning.
- **Life events.** Record meaningful milestones and set an optional check-in date.
- **Shared traditions.** Keep track of annual hikes, recurring dinners, or seasonal visits and plan the next one.
- **Personal timeline.** See meetups, upcoming plans, and notes for one person in date order.
- **Month in review.** See who you spent time with and surface meetups you may want to add details to.
- **Cadence review.** See how often you’ve met and adjust your target when your circumstances change.
- **Reconnect list.** Keep people you’d like to reach out to when time opens up, with reminders optional.
- **Reminisce prompts.** Optionally revisit a past meetup or photo tied to the current date.

### iPhone conveniences and accessibility

- **Home Screen widget.** Glance at upcoming nudges or open a quick logging screen.
- **Privacy-friendly Lock Screen widget.** Show an upcoming reminder count with names hidden by default.
- **Shortcuts.** Create actions to log a meetup, open a person, or show who’s due.
- **Share sheet capture.** Save a venue, event, or activity link into a person’s ideas list.
- **Calendar and reminder links.** Open the associated event or follow-up from inside the app.
- **Apple Watch companion.** See a nudge or log a meetup from the wrist.
- **One-handed quick add.** Use a prominent action and a recent-people picker to log meetups on the go.
- **Accessible timelines.** Make dates, reminder status, and interactive controls usable with large text and VoiceOver, with labels alongside any color cues.
- **Localized dates and notifications.** Respect date formats, calendar preferences, and the user’s local time when traveling.

### Privacy, portability, and recovery

- **Discreet notifications.** Offer lock-screen wording that hides names and personal details.
- **App lock.** Add optional Face ID or passcode protection for the app.
- **Optional device sync.** Keep histories and settings consistent across the user’s devices, including edits and deletions.
- **Backup and restore.** Recover people, history, and settings when replacing a phone.
- **Structured export.** Export profiles and meetup history in a portable format, with an option to exclude notes and attachments.
- **Printable history.** Export a readable timeline for personal use.
- **Import existing logs.** Bring in data from a spreadsheet or supported export with a preview and duplicate handling.
- **Data and permission controls.** Show which integrations are enabled and let users unlink them from within the app.
- **Clear deletion controls.** Delete individual entries, a person’s data, or the entire library, and explain the effect on synced copies if sync is enabled.

## Suggested build order

1. Build manual profiles, meetup logging, history, and due dates. Test whether someone can log a meetup during or just after seeing a friend.
2. Add local notifications, snooze, pause, and archive. Test how date corrections and reminder changes affect the next scheduled nudge.
3. Add multi-person logging, selective contact import, and planning. These reduce repeat work and make it easier to act on a nudge.
4. Revisit integrations, sync, and reflection features after seeing which workflows people use regularly.
