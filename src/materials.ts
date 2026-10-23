export type MaterialChoice = { id: string, text: string }
export type MaterialQuestion = { id: string, prompt: string, choices: MaterialChoice[], answerId: string, explanation: string }
export type Material = { id: string, title: string, body: string, questions: MaterialQuestion[] }

export const materials: Material[] = [
  {
    id: 'daily-focus',
    title: '集中力を保つ小さな工夫',
    body: '集中して作業を続けるには、長時間ではなく短い時間に区切る方法が役立ちます。作業が終わったら姿勢を変え、次に取り組むことを一つだけ決めます。休憩は作業へ戻る準備に使うと、集中を保ちやすくなります。',
    questions: [
      {
        id: 'daily-focus-1',
        prompt: '文章では、作業時間をどのように区切る方法を紹介していますか。',
        choices: [{ id: 'a', text: '短い時間に区切る' }, { id: 'b', text: '休憩を取らずに続ける' }, { id: 'c', text: '予定を毎回増やす' }],
        answerId: 'a',
        explanation: '文章の冒頭で、長時間ではなく短い時間に区切る方法が役立つと説明しています。',
      },
      {
        id: 'daily-focus-2',
        prompt: '一区切りの作業が終わった後に、次に決めることは何ですか。',
        choices: [{ id: 'a', text: '休憩の予定を増やす' }, { id: 'b', text: '次に取り組むことを一つ決める' }, { id: 'c', text: '作業を最初からやり直す' }],
        answerId: 'b',
        explanation: '作業後は、次に取り組むことを一つだけ決めると説明しています.',
      },
    ],
  },
]
