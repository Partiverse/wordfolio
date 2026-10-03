import { describe, expect, it } from 'vitest';

import { buildChoice, senseOptionText, shuffle, type QuizSense } from '../src/study/quiz-core';

const sense = (id: string, headword: string, labelZh: string | null, definitionZh: string): QuizSense => ({
  stableId: id,
  headword,
  pos: 'v',
  labelZh,
  definitionZh,
});

describe('senseOptionText', () => {
  it('prefers label over definition', () => {
    expect(senseOptionText({ labelZh: '跑/奔跑', definitionZh: '用脚快速移动' })).toBe('跑/奔跑');
    expect(senseOptionText({ labelZh: null, definitionZh: '用脚快速移动' })).toBe('用脚快速移动');
  });
});

describe('buildChoice', () => {
  const correct = sense('s1', 'run', '跑/奔跑', '用脚快速移动');
  const pool = [
    sense('s2', 'walk', null, '行走'),
    sense('s3', 'jump', null, '跳跃'),
    sense('s4', 'swim', null, '游泳'),
    sense('s5', 'fly', null, '飞'),
    sense('s1', 'run', null, '重复的正确项'), // 同 stableId
    sense('s6', 'run', null, '同词头义项'), // 同词头不同义项
    sense('s7', 'walk', null, '行走'), // 与 s2 文本重复
  ];

  it('produces exactly 4 options containing the correct one', () => {
    const q = buildChoice(correct, pool, 4);
    expect(q.options).toHaveLength(4);
    expect(q.options.some((o) => o.stableId === 's1')).toBe(true);
  });

  it('never includes duplicate stableIds or texts', () => {
    for (let i = 0; i < 20; i += 1) {
      const q = buildChoice(correct, pool, 4);
      const ids = q.options.map((o) => o.stableId);
      const texts = q.options.map((o) => o.text);
      expect(new Set(ids).size).toBe(ids.length);
      expect(new Set(texts).size).toBe(texts.length);
    }
  });

  it('excludes same-headword senses from distractors', () => {
    for (let i = 0; i < 20; i += 1) {
      const q = buildChoice(correct, pool, 4);
      for (const o of q.options) {
        if (o.stableId === 's1') continue;
        const src = pool.find((p) => p.stableId === o.stableId);
        expect(src?.headword).not.toBe('run');
      }
    }
  });

  it('shrinks gracefully when the pool is small', () => {
    const q = buildChoice(correct, [sense('s2', 'walk', null, '行走')], 4);
    expect(q.options.length).toBe(2);
  });
});

describe('shuffle', () => {
  it('keeps all elements (permutation)', () => {
    const src = [1, 2, 3, 4, 5];
    for (let i = 0; i < 20; i += 1) {
      expect([...shuffle(src)].sort()).toEqual(src);
    }
  });

  it('does not mutate the input', () => {
    const src = [1, 2, 3];
    shuffle(src);
    expect(src).toEqual([1, 2, 3]);
  });
});
