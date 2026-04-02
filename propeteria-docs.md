# Propertia: System Specification & Business Logic

This document outlines the full technical and operational flow for **Propertia**, a property management system designed for precise utility auditing, dynamic shared expense allocation (COSA), and automated invoicing with a **1-peso tolerance** safeguard.

---

## 1. Core Architecture & Data Models

The system relies on five primary data pillars to ensure every centavo is tracked correctly.

| Model               | Responsibility                                                | Key Fields                                    |
| :------------------ | :------------------------------------------------------------ | :-------------------------------------------- |
| **Property / Unit** | Defines the physical space and its "weight" in the building.  | `parentPropertyId`, `unitShares` (e.g., 1, 3) |
| **UtilityRate**     | Tracks the fluctuating cost of Electricity and Water.         | `utilityType`, `ratePerUnit`, `effectiveDate` |
| **ServiceRate**     | Manages daily labor costs for staff.                          | `serviceName`, `dailyRate`, `effectiveDate`   |
| **Contract**        | Links tenants to units and defines the financial timeline.    | `baseRent`, `rentSchedule`, `securityDeposit` |
| **COSAEvent**       | The "Splitter" engine for shared bills (Fuel, Labor, Meters). | `totalAmount`, `category`, `billingMonth`     |

---

## 2. Phase 1: Onboarding (The Foundation)

Before billing begins, the "DNA" of the property and the tenant must be established.

- **Property Setup:** Define units. Crucially, assign **Unit Shares**.
  - _Example:_ Tenant A = 1 share, Tenant B = 3 shares. The system uses these to divide 100% of shared costs.
- **Contract Execution:** Set the rent schedule (e.g., Year 1: ₱0, Year 2: ₱20,000). Record the 2-month security and 2-month advance deposits.
- **Rate Card Initialization:** Enter the starting rates for Electricity, Water, Security, and Maintenance.

---

## 3. Phase 2: Monthly Operations (The Ingredients)

Performed every billing cycle (e.g., end of the month).

### Step A: Update Rates

Check the latest utility provider bill. If the rate changed, add a new entry in the **UtilityRate** table. This ensures the calculation for the current month uses the most recent price.

### Step B: Utility Readings

1. **Individual Meters:** Record the current reading for each tenant's Electricity and Water meters.
2. **COSA Meters:** Record readings for shared resource meters (e.g., Hallway lights, Common water).

### Step C: Labor & Shared Expenses

1. **Duty Days:** Enter the total days worked by Security and Maintenance (e.g., 30 days).
2. **One-Offs:** Enter the total amount from receipts (e.g., ₱7,000 for Generator Fuel).

---

## 4. Phase 3: The "Unit-Share" Splitter Logic

This is the core engine that ensures the owner's costs are covered and the math balances.

1. **The Trigger:** Create an "Expense Event" (e.g., ₱18,000 for Security).
2. **The Selection:** Manually pick the units involved.
3. **The Calculation:**
   - Sum the **Unit Shares** of selected units (e.g., 1 + 3 + 1 + 2 = 7 total shares).
   - `Value per Share = Total Amount / Total Shares`.
4. **The 1-Peso Audit:** If the division results in a remainder (e.g., ₱0.02), the system automatically prompts to add the difference to the largest tenant's line item to ensure the sum exactly matches the bill.

---

## 5. Phase 4: Invoice Generation (Consolidation)

The system pulls data from all modules into a single Statement of Account (SOA).

**Standard Invoice Components:**

- **Base Rent:** Pulled from the Contract Schedule.
- **Individual Utilities:** `(Current - Previous Reading) * Active Utility Rate`.
- **Shared Utilities (COSA):** `(Shared Usage * Rate) / Total Shares * Tenant Shares`.
- **Labor:** `(Days Worked * Service Rate) / Total Shares * Tenant Shares`.
- **Incidentals:** One-off repairs or fuel refills divided by shares.

---

## 6. Technical Implementation Notes (For Developers)

- **Precision:** Use **Decimal/Numeric** types (not Float) in the database to prevent rounding errors.
- **Immutability:** Once an invoice is "Posted," lock the meter readings and shared events associated with it.
- **Auditing:** Implement a "System Loss" report: `Main Building Meter - (Sum of Tenant Meters + COSA Meters)`. Any discrepancy > 1 peso suggests a leak or theft.

---
