import assert from 'node:assert/strict';
import test from 'node:test';
import { answerCare, createCareRouter } from '../backend/companion.mjs';

const care = (question, extras = {}) => answerCare({
  question, language:'en', includeHistory:false,
  readHistory:() => { throw Error('Health records were read without permission.'); },
  ...extras,
});

test('emergency and treatment prompts bypass the local model and personal history', async () => {
  const routeTopic = () => { throw Error('Safety response should bypass provider.'); };
  const urgent = [
    'I have chest pain and trouble breathing',
    'I am dizzy and soaking through pads',
    'Saya hamil dan mengalami pendarahan',
    'Saya ingin mati',
  ];
  for (const question of urgent) {
    const reply = await care(question, { includeHistory:true, routeTopic });
    assert.equal(reply.kind, 'urgent', question);
    assert.equal(reply.context, null);
    assert.equal(reply.provider, 'safety');
  }
  for (const question of ['Do I have PCOS?', 'Apakah aku hamil?', 'Berapa dosis obat?']) {
    assert.equal((await care(question, { language:'id', routeTopic })).kind, 'boundary');
  }
});

test('fallback, source links and follow-up routing work without a model', async () => {
  const reply = await care('How do period predictions work?');
  assert.equal(reply.topic, 'estimate');
  assert.equal(reply.provider, 'library');
  assert.match(reply.sources[0].url, /^https:\/\/www\.bmj\.com\//);
  const followUp = await care('Tell me more', { previousTopic:'sleep' });
  assert.equal(followUp.topic, 'sleep');
  assert.equal((await care('Summarize my saved logs')).context, null);
});

test('the local model receives only the typed question and its enum result is validated', async () => {
  const env = { LUNARA_AI_PROVIDER:'ollama', LUNARA_OLLAMA_PORT:'11435' };
  let observed;
  const route = createCareRouter(env, async (url, request) => {
    observed = { url, body:JSON.parse(request.body), redirect:request.redirect };
    return new Response(JSON.stringify({ message:{ content:'{"topic":"sleep"}' } }));
  });
  assert.equal((await care('Can I make bedtime consistent?', { routeTopic:route })).provider, 'ollama');
  assert.equal(observed.url, 'http://127.0.0.1:11435/api/chat');
  assert.equal(observed.redirect, 'error');
  assert.equal(observed.body.messages.length, 2);
  assert.deepEqual(observed.body.messages[1], { role:'user', content:'Can I make bedtime consistent?' });
  assert.ok(observed.body.format.properties.topic.enum.includes('sleep'));
  const invalid = createCareRouter(env, async () => new Response(JSON.stringify({ message:{ content:'{"topic":"prescribe"}' } })));
  assert.equal(await invalid('question'), null);
});

test('explanations of cycle phases answer in both languages and reject a generic topic match', async () => {
  for (const [question, language, terms] of [
    ['What are the phases of a menstrual cycle?', 'en', /menstruation.*follicular.*ovulation.*luteal/i],
    ['Apa saja fase siklus menstruasi?', 'id', /menstruasi.*folikular.*ovulasi.*luteal/i],
  ]) {
    const reply = await care(question, { language, routeTopic:() => 'cycle' });
    assert.equal(reply.topic, 'phases');
    assert.match(reply.paragraphs[0], terms);
    assert.match(reply.sources[0].url, /^https:\/\/womenshealth\.gov\//);
  }
  assert.equal((await care('Can you predict my ovulation date?')).topic, 'estimate');
});
