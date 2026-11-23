import type { StudyBook } from '../types';

export interface StudyShelf {
  id: string;
  name: string;
  description: string;
  iconName: 'book' | 'graduation-cap' | 'bookmark';
}

export const STUDY_SHELVES: StudyShelf[] = [
  {
    id: 'subjects',
    name: 'Academic Subjects',
    description: 'Core curriculum, theory, STEM & humanities subjects',
    iconName: 'book',
  },
  {
    id: 'courses',
    name: 'Course Shelf',
    description: 'Online bootcamps, technical courses & certifications',
    iconName: 'graduation-cap',
  },
  {
    id: 'reading',
    name: 'Reading & Reference',
    description: 'Deep work books, philosophy & reference manuals',
    iconName: 'bookmark',
  },
];

// Start clean with zero inbuilt dummy books as requested
export const DEFAULT_STUDY_BOOKS: StudyBook[] = [];
