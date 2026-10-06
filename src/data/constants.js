/* App constants: moods, prompts, templates and default settings. */
export const APP = 'J Notes', VERSION = '1.1';

export const MOODS = [null, { n: 'Rough', c: 'var(--mood1)' }, { n: 'Low', c: 'var(--mood2)' }, { n: 'Okay', c: 'var(--mood3)' }, { n: 'Good', c: 'var(--mood4)' }, { n: 'Great', c: 'var(--mood5)' }];
export const ENERGY = ['Low', 'Medium', 'High'];
export const PROMPTS = [
  'What are three things you are grateful for today?', 'What made you smile today?', 'What is one thing you learned today?',
  'What is on your mind right now?', 'What would make tomorrow a good day?', 'Who did you connect with today, and how did it feel?',
  'What drained your energy today? What restored it?', 'What is a small win you want to remember?', 'What are you looking forward to this week?',
  'If today had a title, what would it be?', 'What would you tell yourself one year ago?', 'What is one goal you moved closer to today?',
  'What did you notice today that you usually miss?', 'What is something you want to let go of?', 'Describe a moment today in detail, using all five senses.',
  'What challenged you today, and how did you respond?', 'What are you proud of lately?', 'What does rest look like for you this week?'
];
export const TEMPLATES = {
  'Meeting notes': '## Meeting notes\n\n**Date:** {date}\n**People:** \n\n### Agenda\n- \n\n### Notes\n- \n\n### Action items\n- [ ] \n',
  'To-do list': '## To-do\n\n- [ ] \n- [ ] \n- [ ] \n',
  'Daily review': '## Daily review — {date}\n\n**Wins:**\n- \n\n**Lessons:**\n- \n\n**Tomorrow:**\n- [ ] \n',
  'Book notes': '## Book notes\n\n**Title:** \n**Author:** \n**Rating:** /5\n\n### Key ideas\n- \n\n### Quotes\n> \n\n### My thoughts\n',
  'Project plan': '## Project plan\n\n**Goal:** \n**Deadline:** \n\n### Milestones\n- [ ] \n\n### Risks\n- \n\n### Notes\n'
};

export const DEFAULT_SETTINGS = { name: '', theme: 'auto', font: 'sans', size: 17, lh: 1.7, width: 720, power: false, typewriter: false, toolbar: true, spell: true, mood: true, prompts: true, reminder: '', autolock: 5, onboarded: false, lastReminder: '' };
