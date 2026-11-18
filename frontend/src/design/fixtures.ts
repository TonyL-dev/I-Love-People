export interface SampleMeetup {
  id: string;
  date: string;
  note: string;
}

export interface SamplePerson {
  id: string;
  name: string;
  initials: string;
  lastMet: string | null;
  dueLabel: string;
  group: 'now' | 'soon' | 'later' | 'unknown';
  priority: string;
  cadence: string;
  meetups: SampleMeetup[];
}

// Fixtures deliberately have no account identifiers or connection to application storage.
export const samplePeople: SamplePerson[] = [
  {
    id: 'maya',
    name: 'Maya Chen',
    initials: 'MC',
    lastMet: 'Oct 27, 2026',
    dueLabel: 'Time to catch up',
    group: 'now',
    priority: 'Closest',
    cadence: 'Every 2 weeks',
    meetups: [
      {
        id: 'maya-1',
        date: 'Oct 27, 2026',
        note: 'A long walk and a good catch-up. Ask how the pottery class went.',
      },
      { id: 'maya-2', date: 'Oct 10, 2026', note: 'Coffee on a rainy Saturday.' },
    ],
  },
  {
    id: 'jo',
    name: 'Jo Martin',
    initials: 'JM',
    lastMet: 'Oct 15, 2026',
    dueLabel: 'Time to catch up',
    group: 'now',
    priority: 'Close',
    cadence: 'Every month',
    meetups: [{ id: 'jo-1', date: 'Oct 15, 2026', note: 'Dinner and a good conversation.' }],
  },
  {
    id: 'sam',
    name: 'Sam Rivera',
    initials: 'SR',
    lastMet: 'Nov 9, 2026',
    dueLabel: 'Next catch-up Nov 23',
    group: 'soon',
    priority: 'Closest',
    cadence: 'Every 2 weeks',
    meetups: [{ id: 'sam-1', date: 'Nov 9, 2026', note: 'An afternoon walk.' }],
  },
  {
    id: 'alex',
    name: 'Alex Morgan',
    initials: 'AM',
    lastMet: 'Oct 1, 2026',
    dueLabel: 'Next catch-up Jan 1',
    group: 'later',
    priority: 'Comme ci, comme ça',
    cadence: 'Every 3 months',
    meetups: [{ id: 'alex-1', date: 'Oct 1, 2026', note: '' }],
  },
  {
    id: 'avery',
    name: 'Avery Okafor',
    initials: 'AO',
    lastMet: null,
    dueLabel: 'Add a meetup when you’re ready',
    group: 'unknown',
    priority: 'No priority',
    cadence: 'Reminders off',
    meetups: [],
  },
];
