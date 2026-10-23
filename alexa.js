/**
 * ============================================================================
 *  POCKET REMINDERS: Alexa Skill (single file)
 * ============================================================================
 *  Say things like:
 *    "Alexa, open pocket reminders"
 *    "remind me to renew my passport"
 *    "add a high priority reminder to call the bank"
 *    "what are my reminders"
 *    "complete reminder 2"        "delete reminder 3"
 *    "clear completed reminders"
 *
 *  HOW TO DEPLOY (free, about 10 minutes, Alexa-Hosted):
 *   1. Go to https://developer.amazon.com/alexa/console/ask
 *      Create Skill → name "Pocket Reminders" → Custom → Alexa-hosted (Node.js)
 *      → "Start from Scratch".
 *   2. Build tab → Interaction Model → JSON Editor → paste the JSON from the
 *      bottom of this file (section "INTERACTION MODEL") → Save → Build Model.
 *   3. Code tab → open lambda/index.js → replace EVERYTHING with this file.
 *      Open lambda/package.json and make sure these dependencies exist
 *      (the Alexa-hosted template already includes all three):
 *          "ask-sdk-core", "ask-sdk-model", "ask-sdk-s3-persistence-adapter"
 *      Click Deploy.
 *   4. Test tab → switch to "Development" → type or say:
 *          open pocket reminders
 *
 *  Reminders are stored per Alexa user in S3 (provided by Alexa-Hosted), so
 *  they persist between sessions. Outside Alexa-Hosted the code falls back to
 *  a JSON file in the temp folder, which is fine for local testing only.
 * ============================================================================
 */

const Alexa = require('ask-sdk-core');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* ----------------------------- Persistence ------------------------------- */

function createPersistenceAdapter() {
  if (process.env.S3_PERSISTENCE_BUCKET) {
    try {
      const { S3PersistenceAdapter } = require('ask-sdk-s3-persistence-adapter');
      return new S3PersistenceAdapter({ bucketName: process.env.S3_PERSISTENCE_BUCKET });
    } catch (e) {
      console.error('S3 adapter unavailable, using file storage:', e.message);
    }
  }
  const file = path.join(os.tmpdir(), 'pocket_reminders.json');
  const readAll = () => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return {}; }
  };
  // The SDK passes the raw request envelope to the adapter.
  const keyOf = (requestEnvelope) => Alexa.getUserId(requestEnvelope);
  return {
    async getAttributes(requestEnvelope) { return readAll()[keyOf(requestEnvelope)] || {}; },
    async saveAttributes(requestEnvelope, attrs) {
      const all = readAll();
      all[keyOf(requestEnvelope)] = attrs;
      fs.writeFileSync(file, JSON.stringify(all));
    },
  };
}

/* ------------------------------- Helpers --------------------------------- */

const PRIORITY_RANK = { high: 0, normal: 1, low: 2 };

async function loadReminders(handlerInput) {
  const attrs = (await handlerInput.attributesManager.getPersistentAttributes()) || {};
  return Array.isArray(attrs.reminders) ? attrs.reminders : [];
}

async function saveReminders(handlerInput, reminders) {
  handlerInput.attributesManager.setPersistentAttributes({ reminders });
  await handlerInput.attributesManager.savePersistentAttributes();
}

function activeSorted(reminders) {
  return reminders
    .filter((r) => r.status === 'active')
    .sort((a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      new Date(a.created) - new Date(b.created));
}

// Returns the canonical slot value (e.g. "urgent" resolves to "high").
function canonicalSlot(handlerInput, name) {
  const slot = Alexa.getSlot(handlerInput.requestEnvelope, name);
  if (!slot) return undefined;
  const auth = slot.resolutions && slot.resolutions.resolutionsPerAuthority;
  if (auth && auth[0] && auth[0].status.code === 'ER_SUCCESS_MATCH') {
    return auth[0].values[0].value.name;
  }
  return slot.value;
}

function numberSlot(handlerInput) {
  const n = parseInt(Alexa.getSlotValue(handlerInput.requestEnvelope, 'number'), 10);
  return Number.isNaN(n) ? null : n;
}

const REPROMPT = 'You can say, remind me to, followed by your task. Or ask, what are my reminders.';

/* ------------------------------- Handlers -------------------------------- */

const LaunchRequestHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest',
  async handle(h) {
    const count = activeSorted(await loadReminders(h)).length;
    const status = count === 0
      ? 'You have no active reminders.'
      : `You have ${count} active reminder${count === 1 ? '' : 's'}.`;
    return h.responseBuilder
      .speak(`Welcome to Pocket Reminders. ${status} ${REPROMPT}`)
      .reprompt(REPROMPT)
      .getResponse();
  },
};

const AddReminderIntentHandler = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    Alexa.getIntentName(h.requestEnvelope) === 'AddReminderIntent',
  async handle(h) {
    const text = (Alexa.getSlotValue(h.requestEnvelope, 'reminder') || '').trim();
    if (!text) {
      return h.responseBuilder
        .speak('What would you like me to remind you about?')
        .reprompt('Tell me what to remember.')
        .getResponse();
    }
    const priority = ['high', 'normal', 'low'].includes(canonicalSlot(h, 'priority'))
      ? canonicalSlot(h, 'priority')
      : 'normal';
    const reminders = await loadReminders(h);
    reminders.push({
      id: `rem_${Date.now()}`,
      text,
      priority,
      created: new Date().toISOString(),
      status: 'active',
    });
    await saveReminders(h, reminders);
    const level = priority === 'normal' ? '' : `${priority} priority `;
    return h.responseBuilder
      .speak(`Okay, I added a ${level}reminder: ${text}.`)
      .reprompt('Anything else?')
      .getResponse();
  },
};

const ListRemindersIntentHandler = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    Alexa.getIntentName(h.requestEnvelope) === 'ListRemindersIntent',
  async handle(h) {
    const list = activeSorted(await loadReminders(h));
    if (list.length === 0) {
      return h.responseBuilder
        .speak('You have no active reminders.')
        .reprompt(REPROMPT)
        .getResponse();
    }
    const shown = list.slice(0, 10);
    const spoken = shown
      .map((r, i) => `Number ${i + 1}${r.priority === 'high' ? ', high priority' : ''}: ${r.text}.`)
      .join(' ');
    const more = list.length > shown.length ? ` And ${list.length - shown.length} more.` : '';
    return h.responseBuilder
      .speak(`You have ${list.length} reminder${list.length === 1 ? '' : 's'}. ${spoken}${more}`)
      .reprompt('You can say, complete reminder, followed by its number.')
      .getResponse();
  },
};

const CompleteReminderIntentHandler = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    Alexa.getIntentName(h.requestEnvelope) === 'CompleteReminderIntent',
  async handle(h) {
    const n = numberSlot(h);
    const reminders = await loadReminders(h);
    const list = activeSorted(reminders);
    const target = n && list[n - 1];
    if (!target) {
      return h.responseBuilder
        .speak('I could not find that reminder number. Say, what are my reminders, to hear the list.')
        .reprompt(REPROMPT)
        .getResponse();
    }
    target.status = 'completed';
    target.completed = new Date().toISOString();
    await saveReminders(h, reminders);
    return h.responseBuilder.speak(`Done. I marked ${target.text} as completed.`).getResponse();
  },
};

const DeleteReminderIntentHandler = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    Alexa.getIntentName(h.requestEnvelope) === 'DeleteReminderIntent',
  async handle(h) {
    const n = numberSlot(h);
    const reminders = await loadReminders(h);
    const target = n && activeSorted(reminders)[n - 1];
    if (!target) {
      return h.responseBuilder
        .speak('I could not find that reminder number. Say, what are my reminders, to hear the list.')
        .reprompt(REPROMPT)
        .getResponse();
    }
    await saveReminders(h, reminders.filter((r) => r.id !== target.id));
    return h.responseBuilder.speak(`Okay, I deleted ${target.text}.`).getResponse();
  },
};

const ClearCompletedIntentHandler = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    Alexa.getIntentName(h.requestEnvelope) === 'ClearCompletedIntent',
  async handle(h) {
    const reminders = await loadReminders(h);
    const kept = reminders.filter((r) => r.status === 'active');
    const cleared = reminders.length - kept.length;
    await saveReminders(h, kept);
    return h.responseBuilder
      .speak(cleared === 0
        ? 'There were no completed reminders to clear.'
        : `Cleared ${cleared} completed reminder${cleared === 1 ? '' : 's'}.`)
      .getResponse();
  },
};

const HelpIntentHandler = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.HelpIntent',
  handle: (h) =>
    h.responseBuilder
      .speak('You can say: remind me to call mom. Add a high priority reminder to pay rent. ' +
        'What are my reminders. Complete reminder 1. Delete reminder 2. Or clear completed reminders.')
      .reprompt(REPROMPT)
      .getResponse(),
};

const CancelAndStopIntentHandler = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    ['AMAZON.CancelIntent', 'AMAZON.StopIntent', 'AMAZON.NoIntent'].includes(Alexa.getIntentName(h.requestEnvelope)),
  handle: (h) => h.responseBuilder.speak('Goodbye!').getResponse(),
};

const FallbackIntentHandler = {
  canHandle: (h) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.FallbackIntent',
  handle: (h) =>
    h.responseBuilder
      .speak(`Sorry, I did not get that. ${REPROMPT}`)
      .reprompt(REPROMPT)
      .getResponse(),
};

const SessionEndedRequestHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'SessionEndedRequest',
  handle: (h) => h.responseBuilder.getResponse(),
};

const ErrorHandler = {
  canHandle: () => true,
  handle(h, error) {
    console.error('Skill error:', error);
    return h.responseBuilder
      .speak('Sorry, something went wrong. Please try again.')
      .reprompt('Please try again.')
      .getResponse();
  },
};

/* ------------------------------- Skill entry ------------------------------ */

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    AddReminderIntentHandler,
    ListRemindersIntentHandler,
    CompleteReminderIntentHandler,
    DeleteReminderIntentHandler,
    ClearCompletedIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withPersistenceAdapter(createPersistenceAdapter())
  .lambda();

/* ============================================================================
 *  INTERACTION MODEL: paste into Build → Interaction Model → JSON Editor
 * ============================================================================
{
  "interactionModel": {
    "languageModel": {
      "invocationName": "pocket reminders",
      "intents": [
        { "name": "AMAZON.CancelIntent", "samples": [] },
        { "name": "AMAZON.HelpIntent", "samples": [] },
        { "name": "AMAZON.StopIntent", "samples": [] },
        { "name": "AMAZON.NoIntent", "samples": [] },
        { "name": "AMAZON.FallbackIntent", "samples": [] },
        {
          "name": "AddReminderIntent",
          "slots": [
            { "name": "reminder", "type": "AMAZON.SearchQuery" },
            { "name": "priority", "type": "PRIORITY" }
          ],
          "samples": [
            "remind me to {reminder}",
            "add a reminder to {reminder}",
            "add reminder {reminder}",
            "add a {priority} priority reminder to {reminder}",
            "set a {priority} priority reminder to {reminder}",
            "create a {priority} priority reminder to {reminder}"
          ]
        },
        {
          "name": "ListRemindersIntent",
          "slots": [],
          "samples": [
            "what are my reminders",
            "read my reminders",
            "list my reminders",
            "check my reminders",
            "what do I need to do"
          ]
        },
        {
          "name": "CompleteReminderIntent",
          "slots": [{ "name": "number", "type": "AMAZON.NUMBER" }],
          "samples": [
            "complete reminder {number}",
            "mark reminder {number} as done",
            "finish reminder {number}",
            "mark number {number} done"
          ]
        },
        {
          "name": "DeleteReminderIntent",
          "slots": [{ "name": "number", "type": "AMAZON.NUMBER" }],
          "samples": [
            "delete reminder {number}",
            "remove reminder {number}",
            "delete number {number}"
          ]
        },
        {
          "name": "ClearCompletedIntent",
          "slots": [],
          "samples": [
            "clear completed reminders",
            "clear finished reminders",
            "clean up my reminders"
          ]
        }
      ],
      "types": [
        {
          "name": "PRIORITY",
          "values": [
            { "name": { "value": "high", "synonyms": ["urgent", "important", "top", "critical"] } },
            { "name": { "value": "normal", "synonyms": ["medium", "regular", "standard"] } },
            { "name": { "value": "low", "synonyms": ["minor", "whenever", "unimportant"] } }
          ]
        }
      ]
    }
  }
}
 * ============================================================================
 */
