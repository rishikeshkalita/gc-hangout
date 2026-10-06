import test from "node:test";
import assert from "node:assert/strict";
import {
  VOICE_STATES, canAttack, createLocalPlayer, upsertPlayer, removePlayer, applyPlayerState,
  beginInteraction, arriveInteraction, releaseInteraction, startEmote, finishEmote,
  claimSeat, releaseSeat, normalizeChatMessage, mergeChatMessages,
  normalizeMusicResponse, classifyMusicResponse, voiceTransition,
} from "../lib/game-state.mjs";

test("local player exists immediately and remains stable without movement", () => {
  const player = createLocalPlayer({id:"p1", name:"Rishi", avatarId:"maya"});
  let players = upsertPlayer({}, player);
  assert.equal(players.p1.id, "p1");
  players = upsertPlayer(players, {...player, x:2, z:3});
  assert.equal(Object.keys(players).length, 1);
  assert.equal(players.p1.x, 2);
});

test("player join/leave/reconnect are idempotent", () => {
  const p = createLocalPlayer({id:"p1", name:"A", avatarId:"maya"});
  let players = upsertPlayer({}, p);
  players = upsertPlayer(players, p);
  assert.equal(Object.keys(players).length, 1);
  players = removePlayer(players, "p1");
  assert.deepEqual(players, {});
  players = upsertPlayer(players, p);
  assert.equal(players.p1.id, "p1");
});

test("stale movement state cannot overwrite newer player state", () => {
  const current = {id:"p1", x:5, netTs:200};
  const stale = {id:"p1", x:1, netTs:100};
  assert.deepEqual(applyPlayerState({p1:current}, stale), {p1:current});
});

test("seat interaction blocks conflicting local states", () => {
  const p = createLocalPlayer({id:"p1", name:"A", avatarId:"maya"});
  const seat = {id:"seat-1", type:"seat", position:[1,0,1], rotation:0, seatY:-.4, poseType:"sofa"};
  const moving = beginInteraction(p, seat);
  assert.equal(moving.id, "seat-1");
  const seated = arriveInteraction(p, seat);
  assert.equal(seated.action, "sit");
  assert.equal(seated.interactionId, "seat-1");
  assert.equal(beginInteraction(seated, seat), null);
  assert.equal(beginInteraction({...p, action:"emote"}, seat), null);
  assert.equal(releaseInteraction(seated).action, null);
});

test("simultaneous seat claims resolve to one holder", () => {
  const first = claimSeat({}, "seat-1", "p1");
  const second = claimSeat(first.locks, "seat-1", "p2");
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(releaseSeat(first.locks, "seat-1", "p2")["seat-1"], "p1");
  assert.equal(releaseSeat(first.locks, "seat-1", "p1")["seat-1"], undefined);
});

test("combat cannot start while sitting, sleeping, watching, moving or emoting", () => {
  const p = createLocalPlayer({id:"p1", name:"A", avatarId:"maya"});
  assert.equal(canAttack(p), true);
  for (const action of ["sit","sleep","watch","moving","emote"]) assert.equal(canAttack({...p, action}), false);
});

test("emotes always have an exit transition", () => {
  const p = createLocalPlayer({id:"p1", name:"A", avatarId:"maya"});
  const emote = startEmote(p, "dance");
  assert.equal(emote.action, "emote");
  assert.equal(finishEmote(emote).action, null);
  assert.equal(finishEmote({...emote, action:"emote"}).emote, null);
  assert.equal(startEmote({...p, action:"sit"}, "wave"), null);
});

test("chat normalization and merge deduplicate messages", () => {
  const m = normalizeChatMessage({id:"m1", name:" A ", text:"hello\nworld", ts:10}, 20);
  assert.deepEqual(m, {id:"m1", name:"A", text:"hello world", ts:10});
  const merged = mergeChatMessages([m], [m, {id:"m2",name:"B",text:"second",ts:11}], 20);
  assert.equal(merged.length, 2);
  assert.deepEqual(mergeChatMessages(merged, m, 20), merged);
});

test("music normalization handles playable, empty and malformed responses", () => {
  const data = {results:[{id:1,name:"Track",artist_name:"Artist",audio:"https://audio.example/1.mp3",duration:"123",license_ccurl:"cc"}]};
  assert.equal(normalizeMusicResponse(data).length, 1);
  assert.deepEqual(normalizeMusicResponse({results:[]}), []);
  assert.deepEqual(normalizeMusicResponse({}), []);
  assert.equal(classifyMusicResponse({status:200,data}), "AVAILABLE");
  assert.equal(classifyMusicResponse({status:200,data:{results:[]}}), "NO_MUSIC");
  assert.equal(classifyMusicResponse({status:502,data:{configured:true,error:"x"}}), "API_ERROR");
  assert.equal(classifyMusicResponse({status:503,data:{configured:false}}), "NOT_CONFIGURED");
});

test("voice state machine is explicit", () => {
  let state = VOICE_STATES.OFF;
  state = voiceTransition(state, "REQUEST");
  assert.equal(state, VOICE_STATES.REQUESTING_PERMISSION);
  state = voiceTransition(state, "PERMISSION_GRANTED");
  assert.equal(state, VOICE_STATES.LIVE);
  state = voiceTransition(state, "MUTE");
  assert.equal(state, VOICE_STATES.MUTED);
  state = voiceTransition(state, "UNMUTE");
  assert.equal(state, VOICE_STATES.LIVE);
  state = voiceTransition(state, "DISCONNECT");
  assert.equal(state, VOICE_STATES.DISCONNECTED);
  assert.equal(voiceTransition(state, "OFF"), VOICE_STATES.OFF);
  assert.equal(voiceTransition(VOICE_STATES.OFF, "ERROR"), VOICE_STATES.ERROR);
});
