<script lang="ts">
/**
 * Modal dialog explaining the provably fair system to players.
 * Covers drand public randomness, hash chains, and round verification
 * in plain English.
 *
 * Uses the native <dialog> element for built-in focus trap, Escape key handling,
 * and proper ARIA semantics via showModal()/close().
 *
 * @see docs/provably-fair.md §1.0
 */
import { onMount } from 'svelte';

let { onClose }: { onClose: () => void } = $props();

let dialogEl: HTMLDialogElement;

onMount(() => {
  dialogEl.showModal();
});

function handleDialogClick(e: MouseEvent) {
  // Backdrop click: the target is the <dialog> element itself (not its content)
  if (e.target === dialogEl) {
    onClose();
  }
}

function handleCancel(e: Event) {
  // Native cancel event fires when Escape is pressed; prevent default close and delegate to onClose
  e.preventDefault();
  onClose();
}
</script>

<dialog
  bind:this={dialogEl}
  class="modal"
  aria-labelledby="fairness-title"
  onclick={handleDialogClick}
  oncancel={handleCancel}
>
  <div class="modal-jp">証明可能な公平性</div>
  <h3 id="fairness-title">PROVABLY FAIR</h3>

  <section class="section">
    <h4>What does "provably fair" mean?</h4>
    <p>
      In a typical online game the server decides the outcome and tells you after the fact — you
      have to trust the operator completely. This game is different: the crash point is decided
      <strong>before</strong> you place your bet, locked in with a cryptographic commitment, and
      every ingredient needed to verify it is published after the round ends. No trust required.
    </p>
  </section>

  <section class="section">
    <h4>The sealed-envelope analogy</h4>
    <p>
      Imagine writing a secret number on a piece of paper, sealing it in an envelope, and handing
      it to a stranger <em>before</em> any bets are placed. Nobody can change what's inside once
      it's sealed. After the round everyone opens the envelope together and checks the contents
      match what happened.
    </p>
    <p>
      That's exactly what this game does — except the "envelope" is a cryptographic hash, which
      is mathematically impossible to fake or reverse-engineer.
    </p>
  </section>

  <section class="section">
    <h4>Independent randomness via drand</h4>
    <p>
      Even with a sealed commitment you might wonder: "did you choose a number that makes the
      house win?" To prevent that, the crash point is mixed with a random value from{' '}
      <strong>drand</strong> — a public randomness beacon run by universities and research
      institutions around the world. Nobody controls drand, not even us.
    </p>
    <p>
      Critically, <strong>we do not know the crash point of any future round</strong> until wagers
      have been placed and that round begins. The result only becomes knowable at the exact moment
      we fetch the drand value for that round.
    </p>
  </section>

  <section class="section">
    <h4>How hash chains work</h4>
    <p>
      Before the game starts, we generate a root seed and apply SHA-256 hashing 10,000 times to
      produce a chain of seeds. The final hash — the <em>chain commitment</em> — is published
      immediately. Each round consumes one seed from this chain in reverse order.
    </p>
    <p>
      Because SHA-256 is a one-way function, publishing the chain commitment does not reveal any
      future seeds. After each round we reveal that round's seed; you can confirm it hashes to the
      value we committed to.
    </p>
  </section>

  <section class="section">
    <h4>The exact sequence each round</h4>
    <ol>
      <li>We publish the <em>chain commitment</em> (the sealed envelope).</li>
      <li>You place your bet during the countdown.</li>
      <li>
        The round starts. We fetch the latest drand value (public, timestamped, immutable) and
        combine it with the pre-committed seed to produce the crash point. Neither ingredient
        alone is enough.
      </li>
      <li>The multiplier climbs. You decide when to cash out.</li>
      <li>When the round ends, we reveal the seed we used.</li>
      <li>
        You can verify: the revealed seed hashes to the commitment we published, and
        re-computing the crash point from seed + drand gives the same number you saw.
      </li>
    </ol>
  </section>

  <section class="section">
    <h4>How to verify any round</h4>
    <p>
      Click <strong>"Verify"</strong> next to any round in the history panel. The page
      re-computes the crash point from the public ingredients and confirms it matches what was
      displayed — no special software, no downloads, no trust required.
    </p>
  </section>

  <button onclick={onClose}>[ CLOSE ]</button>
</dialog>

<style>
  .modal {
    background: #0a0800;
    border: 1px solid var(--color-border, #332800);
    border-radius: 0;
    padding: 1.5rem;
    max-width: 560px;
    width: 90%;
    max-height: 85vh;
    overflow-y: auto;
    font-family: 'Fira Code', monospace;
    color: var(--color-primary, #ffb000);
  }

  .modal::backdrop {
    background: rgba(0, 0, 0, 0.85);
  }

  .modal-jp {
    font-size: 0.65rem;
    color: var(--color-primary-dim-text, #c08400);
    letter-spacing: 0.2em;
    margin-bottom: 0.25rem;
  }

  .modal h3 {
    color: var(--color-primary, #ffb000);
    margin-top: 0;
    margin-bottom: 1rem;
    font-size: 1rem;
    letter-spacing: 0.15em;
    font-weight: 700;
  }

  .section {
    margin-bottom: 1.25rem;
  }

  .section h4 {
    color: var(--color-primary-mid, #cc8800);
    margin: 0 0 0.4rem 0;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .section p,
  .section ol {
    color: var(--color-primary-dim-text, #c08400);
    font-size: 0.85rem;
    line-height: 1.6;
    margin: 0 0 0.5rem 0;
  }

  .section ol {
    padding-left: 1.4rem;
  }

  .section li {
    margin-bottom: 0.35rem;
  }

  strong {
    color: var(--color-primary, #ffb000);
  }

  em {
    color: var(--color-primary-mid, #cc8800);
    font-style: normal;
  }

  button {
    background: transparent;
    border: 1px solid var(--color-border, #332800);
    color: var(--color-primary-dim-text, #c08400);
    padding: 0.5rem 1rem;
    font-family: 'Fira Code', monospace;
    font-size: 0.85rem;
    cursor: pointer;
    margin-top: 0.5rem;
    letter-spacing: 0.05em;
  }

  button:hover {
    border-color: var(--color-primary-dim, #805800);
    color: var(--color-primary-mid, #cc8800);
  }
</style>
