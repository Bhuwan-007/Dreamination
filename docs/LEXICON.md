# Personal Symbol Lexicon & Dirichlet Distribution Model

The Dream Machine rejects one-size-fits-all generic dream dictionaries (*e.g.*, "water always means repressed emotions"). Instead, the system treats each user's mind as an evolving, idiosyncratic symbolic system. 

Each symbol associated with a user maintains a learned probability distribution over possible meanings, updated dynamically via resonance feedback.

---

## 1. The Dirichlet-Categorical Mathematical Formulation

For each user $u$ and symbol entity $e$, the possible meanings $\mathcal{M} = \{m_1, m_2, \dots, m_K\}$ are modeled as a categorical distribution parameterized by $\boldsymbol{\theta} = (\theta_1, \dots, \theta_K)$ where $\sum_{k=1}^K \theta_k = 1$.

The prior belief follows a Dirichlet distribution:
$$\boldsymbol{\theta} \sim \text{Dirichlet}(\boldsymbol{\alpha})$$
where $\boldsymbol{\alpha} = (\alpha_1, \alpha_2, \dots, \alpha_K)$ represents the pseudo-counts (evidence weights) for each meaning.

The expected probability of meaning $m_k$ is:
$$\mathbb{E}[\theta_k] = \frac{\alpha_k}{\sum_{j=1}^K \alpha_j}$$

---

## 2. Priors & Initial State

- When an LLM first suggests a contextual meaning $m_0$ for a symbol, an initial weak prior is assigned:
  $$\alpha_0 = 1.0, \quad \text{evidence\_count} = 1$$
- This deliberate weak prior ensures that a single generic model interpretation does not lock the user into an assumption.

---

## 3. Resonance Updates & Temporal Decay

When the user reviews reflection threads in Phase 6, their feedback updates the distribution:

### Case A: User clicks "That resonates"
- The chosen thread's meaning label $m_k$ is reinforced:
  $$\alpha_k \leftarrow \alpha_k + \Delta_{\text{res}}, \quad \text{where } \Delta_{\text{res}} = 2.0$$
- $\text{evidence\_count} \leftarrow \text{evidence\_count} + 1$.

### Case B: User clicks "That felt different"
- The suggested meaning label $m_k$ is penalized:
  $$\alpha_k \leftarrow \max(0.2, \alpha_k - \Delta_{\text{pen}}), \quad \text{where } \Delta_{\text{pen}} = 1.0$$
- If the user provides a custom personal note (*e.g.*, *"the water felt suffocating and icy rather than calming"*):
  1. A candidate label is extracted from the note (*e.g.*, *"suffocating / icy"*).
  2. If the label already exists in the distribution, it receives $\Delta_{\text{new}} = 2.5$.
  3. If it is a new label, it is added to the Dirichlet vector with $\alpha_{\text{new}} = 2.5$, giving the user's explicit self-knowledge immediate primacy.

### Temporal Decay
To allow the dreamer's personal symbology to evolve over months and years without becoming statically ossified by old dreams, an exponential decay factor $\lambda \in [0.95, 0.99]$ is applied to older counts over elapsed time:
$$\alpha_j(t) = 1.0 + (\alpha_j(t_0) - 1.0) \cdot e^{-\lambda \Delta t}$$

---

## 4. Normalization and Retrieval

After updates, the normalized probabilities are computed and persisted in `symbol_meanings`:
$$\text{probability}(m_k) = \frac{\alpha_k}{\sum_{j=1}^K \alpha_j}$$

When future dreams are reconstructed or interpreted, `get_relevant_history(user_id, dream_id)` retrieves all symbol distributions where $\text{evidence\_count} \ge 2$ and injects them into Prompt P5 under `<learned_meanings>`. This ensures the companion uses the dreamer's actual learned vocabulary:
> *"In your earlier dreams, water tended to carry a suffocating or rigid quality for you, rather than a peaceful one."*
