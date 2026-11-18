import type { SamplePerson } from './fixtures';
export type SampleState = 'ready' | 'empty' | 'loading' | 'error' | 'offline';
export interface PersonActions {
  setLogging: (person: SamplePerson) => void;
  setOptions: (person: SamplePerson) => void;
}
