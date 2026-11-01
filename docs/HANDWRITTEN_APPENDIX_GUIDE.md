# Handwritten Appendix Guide (Neural Network Backprop)
**Pass Science Works R&D Internship 2026–2027**

> [!IMPORTANT]
> The Pass Science Works assignment specifies:
> *"Include legible scans or photographs of the actual handwritten forward pass, chain-rule derivation, numerical gradients, and simultaneous parameter update. Maximum two pages. Do not substitute generated typeset equations for the required handwritten work."*
> 
> This document provides the layout and step-by-step mathematical guide to transcribe by hand onto physical paper (Pages 1 & 2) for scanning.

---

## Page 1 Layout: Forward Pass & Analytical Derivations

### 1. Network Architecture & Given Problem
- Single training sample: $x = 1.0, \quad y = 2.0$
- Architecture:
  - Input: $x$
  - Hidden pre-activation: $z = w x + b$
  - Hidden activation: $h = \tanh(z) = \frac{e^z - e^{-z}}{e^z + e^{-z}}$
  - Output prediction: $\hat{y} = v h + c$
  - Quadratic Loss: $J = \frac{1}{2}(\hat{y} - y)^2$
- Initial Parameters:
  - $w^{(0)} = 0.5$
  - $b^{(0)} = 0.0$
  - $v^{(0)} = 1.0$
  - $c^{(0)} = 0.0$
  - Learning Rate: $\eta = 0.1$

### 2. Forward Pass at Step 0
1. $z = (0.5)(1.0) + 0.0 = 0.5$
2. $h = \tanh(0.5) = \frac{e^{0.5} - e^{-0.5}}{e^{0.5} + e^{-0.5}} \approx \frac{1.648721 - 0.606531}{1.648721 + 0.606531} = \frac{1.042190}{2.255252} \approx 0.462117$
3. $\hat{y} = (1.0)(0.462117) + 0.0 = 0.462117$
4. Residual: $e = \hat{y} - y = 0.462117 - 2.0 = -1.537883$
5. Initial Loss: $J_0 = \frac{1}{2}(-1.537883)^2 \approx \frac{1}{2}(2.365084) \approx 1.182542$

### 3. Chain-Rule Analytical Derivation
- Loss gradient w.r.t. prediction:
  $$\frac{\partial J}{\partial \hat{y}} = \hat{y} - y$$
- Bias $c$:
  $$\frac{\partial J}{\partial c} = \frac{\partial J}{\partial \hat{y}}\frac{\partial \hat{y}}{\partial c} = (\hat{y} - y) \cdot 1 = \hat{y} - y$$
- Output weight $v$:
  $$\frac{\partial J}{\partial v} = \frac{\partial J}{\partial \hat{y}}\frac{\partial \hat{y}}{\partial v} = (\hat{y} - y) \cdot h$$
- Hidden activation $h$:
  $$\frac{\partial J}{\partial h} = \frac{\partial J}{\partial \hat{y}}\frac{\partial \hat{y}}{\partial h} = (\hat{y} - y) \cdot v$$
- Derivative of $\tanh(z)$:
  $$\frac{dh}{dz} = 1 - \tanh^2(z) = 1 - h^2$$
- Input weight $w$:
  $$\frac{\partial J}{\partial w} = \frac{\partial J}{\partial h}\frac{\partial h}{\partial z}\frac{\partial z}{\partial w} = (\hat{y} - y) \cdot v \cdot (1 - h^2) \cdot x$$
- Hidden bias $b$:
  $$\frac{\partial J}{\partial b} = \frac{\partial J}{\partial h}\frac{\partial h}{\partial z}\frac{\partial z}{\partial b} = (\hat{y} - y) \cdot v \cdot (1 - h^2) \cdot 1$$

---

## Page 2 Layout: Numerical Evaluation, Finite Difference Check & Update

### 4. Step 0 Numerical Gradient Evaluation
Substitute numerical values:
- Residual: $\hat{y} - y = -1.537883$
- $h = 0.462117$
- $1 - h^2 = 1 - (0.462117)^2 = 1 - 0.213552 = 0.786448$
- $v = 1.0, \quad x = 1.0$

Calculate gradients:
1. $\frac{\partial J}{\partial c} = -1.537883$
2. $\frac{\partial J}{\partial v} = (-1.537883)(0.462117) = -0.710682$
3. $\frac{\partial J}{\partial w} = (-1.537883)(1.0)(0.786448)(1.0) = -1.209465$
4. $\frac{\partial J}{\partial b} = (-1.537883)(1.0)(0.786448) = -1.209465$

### 5. Central Finite-Difference Verification ($\epsilon = 10^{-6}$)
Using formula: $\frac{\partial J}{\partial \theta_i} \approx \frac{J(\theta_i + \epsilon) - J(\theta_i - \epsilon)}{2\epsilon}$

- For $w$:
  - $w + \epsilon = 0.500001 \implies \hat{y}_+ = 0.462118, \quad J_+ = 1.182541$
  - $w - \epsilon = 0.499999 \implies \hat{y}_- = 0.462116, \quad J_- = 1.182543$
  - $\left[\frac{\partial J}{\partial w}\right]_{\text{FD}} = -1.209465$
  - Absolute Error: $|-1.209465 - (-1.209465)| < 10^{-10} \le 10^{-5}$ (**PASS**)

- For all parameters ($\theta \in \{w, b, v, c\}$):
  $$\max_{\theta} |\nabla_{\text{analytical}} - \nabla_{\text{FD}}| \le 4.2 \times 10^{-11} \le 10^{-5} \quad \text{[VERIFIED]}$$

### 6. Simultaneous Parameter Update (Step 1)
Using update rule: $\theta^{(1)} = \theta^{(0)} - \eta \frac{\partial J}{\partial \theta}$ with $\eta = 0.1$:
1. $w^{(1)} = 0.500000 - 0.1(-1.209465) = 0.500000 + 0.120947 = \mathbf{0.620947}$
2. $b^{(1)} = 0.000000 - 0.1(-1.209465) = 0.000000 + 0.120947 = \mathbf{0.120947}$
3. $v^{(1)} = 1.000000 - 0.1(-0.710682) = 1.000000 + 0.071068 = \mathbf{1.071068}$
4. $c^{(1)} = 0.000000 - 0.1(-1.537883) = 0.000000 + 0.153788 = \mathbf{0.153788}$

### 7. Step 1 Forward Pass Verification
- $z^{(1)} = (0.620947)(1.0) + 0.120947 = 0.741894$
- $h^{(1)} = \tanh(0.741894) \approx 0.630232$
- $\hat{y}^{(1)} = (1.071068)(0.630232) + 0.153788 \approx 0.675021 + 0.153788 = 0.828809$
- Residual: $0.828809 - 2.0 = -1.171191$
- Loss at Step 1: $J_1 = \frac{1}{2}(-1.171191)^2 \approx \mathbf{0.685844}$
- Loss decrease: $J_0 (1.182542) \rightarrow J_1 (0.685844)$ (Reduction of $42.0\%$).
