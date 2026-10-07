/**
 * Rocket sounds, made with the Web Audio API so there are no sound files to load or license.
 *
 * Browsers only allow sound after the visitor has interacted with the page; `unlock()` is called
 * on the first click or key press, and until then the sounds are silently skipped.
 */

let context = null;

/**
 * The shared audio context, created on first use.
 *
 * @returns {AudioContext|null} Context, or null where Web Audio is not available.
 */
const getContext = () =>
{
  if ( context ) return context;
  const Context = typeof window !== 'undefined' && ( window.AudioContext || window.webkitAudioContext );
  context = Context ? new Context() : null;
  return context;
};

/**
 * Allow sound from now on; call from a click or key press.
 *
 * @returns {void}
 */
export const unlock = () =>
{
  const audio = getContext();
  if ( audio && audio.state === 'suspended' ) audio.resume();
};

/**
 * Whether sound can play right now.
 *
 * @returns {AudioContext|null} The running context, or null.
 */
const running = () =>
{
  const audio = getContext();
  return audio && audio.state === 'running' ? audio : null;
};

/**
 * Air raid siren: a sawtooth tone sweeping up and down a few times.
 *
 * @param {number} cycles Number of rises and falls.
 * @returns {void}
 */
export const playAlarm = ( cycles = 3 ) =>
{
  const audio = running();
  if ( !audio ) return;

  const now = audio.currentTime,
        cycle = 1.4,
        end = now + cycles * cycle,
        tone = audio.createOscillator(),
        volume = audio.createGain();

  tone.type = 'sawtooth';
  tone.frequency.setValueAtTime( 300, now );
  for ( let i = 0; i < cycles; i++ )
  {
    tone.frequency.linearRampToValueAtTime( 900, now + i * cycle + cycle * .6 );
    tone.frequency.linearRampToValueAtTime( 300, now + ( i + 1 ) * cycle );
  }

  volume.gain.setValueAtTime( 0, now );
  volume.gain.linearRampToValueAtTime( .12, now + .2 );
  volume.gain.setValueAtTime( .12, end - .4 );
  volume.gain.linearRampToValueAtTime( 0, end );

  tone.connect( volume ).connect( audio.destination );
  tone.start( now );
  tone.stop( end );
};

/**
 * Explosion: a burst of filtered noise for the blast, with a falling low tone for the boom.
 *
 * @returns {void}
 */
export const playImpact = () =>
{
  const audio = running();
  if ( !audio ) return;

  const now = audio.currentTime,
        length = 3;

  // blast: white noise through a low-pass filter that closes over time
  const noise = audio.createBuffer( 1, audio.sampleRate * length, audio.sampleRate );
  const samples = noise.getChannelData( 0 );
  for ( let i = 0; i < samples.length; i++ ) samples[ i ] = Math.random() * 2 - 1;

  const blast = audio.createBufferSource(),
        filter = audio.createBiquadFilter(),
        blast_volume = audio.createGain();
  blast.buffer = noise;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime( 2000, now );
  filter.frequency.exponentialRampToValueAtTime( 80, now + length );
  blast_volume.gain.setValueAtTime( .6, now );
  blast_volume.gain.exponentialRampToValueAtTime( .001, now + length );
  blast.connect( filter ).connect( blast_volume ).connect( audio.destination );
  blast.start( now );

  // boom: a low sine wave dropping in pitch
  const boom = audio.createOscillator(),
        boom_volume = audio.createGain();
  boom.type = 'sine';
  boom.frequency.setValueAtTime( 90, now );
  boom.frequency.exponentialRampToValueAtTime( 25, now + 2 );
  boom_volume.gain.setValueAtTime( .8, now );
  boom_volume.gain.exponentialRampToValueAtTime( .001, now + 2.5 );
  boom.connect( boom_volume ).connect( audio.destination );
  boom.start( now );
  boom.stop( now + 2.5 );
};
