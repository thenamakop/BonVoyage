**TripSync AI**

*Collaborative Trip Planner*

**Phase 1 Project Documentation**

Prepared by: Maulik Gupta

BML Munjal University

Department of Computer Science and Engineering

August 2026

Table of Contents

|                                 |     |
|---------------------------------|-----|
| **1. Introduction**             | 3   |
| **2. Problem Statement**        | 3   |
| **3. Context and Significance** | 3   |
| **4. Input Requirements**       | 3   |
| **5. Methodology**              | 4   |
| 5.1 System Workflow             | 4   |
| 5.2 Key Features                | 5   |
| 5.3 Proposed Technology Stack   | 5   |
| **6. Expected Output**          | 5   |
| 6.1 Output Characteristics      | 5   |
| 6.2 Illustrative Example        | 6   |
| **7. Objective and Conclusion** | 6   |

1\. Introduction

TripSync AI is an intelligent, AI-powered trip-planning assistant designed to simplify the process of organizing group travel. Rather than relying on lengthy group chats, scattered spreadsheets, and back-and-forth negotiation, TripSync AI collects structured input from each participant — destination preferences, activities of interest, availability, budget, and travel history — and uses this information to generate a complete, personalized, and cost-transparent trip plan. This document constitutes the Phase 1 deliverable for the TripSync AI project and establishes the problem framing, input structure, methodology, and expected output that will guide subsequent design and implementation phases.

2\. Problem Statement

Planning a trip with a group of friends is a common but surprisingly difficult coordination problem. Each participant typically brings a distinct set of preferences: one member may want a beach destination, another may prefer mountains or hiking trails, and a third may be drawn to cultural or historical sites. Compounding this, group members rarely share identical budgets, and their available dates frequently overlap only partially, or not at all. Reconciling these constraints manually is time-consuming, prone to miscommunication, and often results in decisions that satisfy no one fully, or in trip plans that are abandoned before they are finalized.

TripSync AI addresses this problem directly by automating the end-to-end planning process. It systematically collects each member’s preferences, constraints, and history; algorithmically identifies destinations and itineraries that maximize collective satisfaction; and produces a ready-to-book plan with full transparency on cost and logistics, eliminating the inefficiency of manual reconciliation.

3\. Context and Significance

Group travel — among college friends, coworkers, or family units — is a frequent and recurring need, yet the tools most groups currently rely on (chat threads, shared spreadsheets, informal polls) were not designed for multi-constraint optimization. They place the entire coordination burden on one or two organizers, who must manually cross-reference availability calendars, negotiate budget ranges, and research destinations and prices, often without a clear or fair way to weigh competing preferences.

This project is significant because it demonstrates a practical, real-world application of AI-driven decision-making to a multi-constraint optimization problem — one that combines qualitative preference data (destination type, activity interests, past travel patterns) with hard constraints (date availability, budget ceilings, starting-point distance) to produce an actionable recommendation. As Phase 1 of the TripSync AI project, this document defines the problem space, the data the system requires, the methodology it will follow, and the form its output will take, providing the conceptual foundation for the design and build phases that follow.

4\. Input Requirements

For TripSync AI to generate a trip plan that genuinely reflects the group’s needs, it requires structured input from every participant. Table 1 summarizes the categories of data collected and the purpose each serves.

*Table 1. Input categories collected from each participant.*

| **Input Category**                 | **Description**                                                                                                            | **Example**                                   |
|------------------------------------|----------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------|
| Destination & Activity Preferences | Preferred destination type (beach, mountains, city, etc.), specific activities of interest, and climate preference         | Beach destination, water sports, warm climate |
| Availability                       | Earliest and latest dates each member can travel, used to compute the group’s common travel window                         | Available 1st–7th March                       |
| Budget Range                       | Minimum and maximum spend the member is comfortable with, per person or as a household contribution                        | ₹10,000–₹15,000 per person                    |
| Past Trip History                  | Destinations previously visited and the member’s impression of them, used to infer personal taste patterns                 | Hawaii (beach), enjoyed water activities      |
| Starting Point                     | City or location each member (or the group collectively) will be travelling from, used for distance/radius-based filtering | Departing from Gurugram                       |
| Transport Mode Preference          | Preferred mode of travel — self-drive/rental car, bus, or train — collected once a destination is shortlisted              | Train preferred over bus                      |

5\. Methodology

TripSync AI follows a structured, six-step process that takes the group from individual preference collection to a finalized, bookable itinerary.

5.1 System Workflow

*Table 2. TripSync AI six-step workflow.*

| **Step**                                    | **Description**                                                                                                                                                                          |
|---------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1\. Preference & Availability Collection    | Each group member submits their destination preferences, activity interests, available date range, and budget through a simple input interface.                                          |
| 2\. Data Aggregation & Destination Analysis | The AI aggregates all individual inputs and identifies the destinations that best satisfy the group’s combined preferences, common availability window, and budget constraints.          |
| 3\. Destination Selection                   | The group selects a destination from the AI’s shortlist, or allows the AI to auto-suggest one, optionally filtered by distance/radius from a specified starting point.                   |
| 4\. Transport Preference & Cost Comparison  | The AI asks whether the group prefers to rent a car, travel by bus, or take a train, then calculates and presents a cost comparison across the available modes.                          |
| 5\. Package Generation                      | The AI generates several complete trip packages, each varying by hotel choice, room configuration, and transport combination, for side-by-side comparison.                               |
| 6\. Final Itinerary Generation              | Once the group selects a package, the AI produces the final itemized itinerary, including a full cost breakdown and a day-by-day plan covering transport, accommodation, and activities. |

5.2 Key Features

- **Preference Collection:** Structured intake of destination type, activity interests, climate preference, available time slots, budget range, and past trip history for every participant.

- **AI-Powered Destination Recommendation:** Analyzes combined group data to recommend destinations that satisfy the majority of preferences and constraints, with support for filtering by distance/radius from a chosen starting point.

- **Budget & Duration-Based Planning:** Given a total budget and trip length, generates itinerary options that fit within those constraints.

- **Transport Mode Selection:** Compares the cost and feasibility of renting a car, taking a bus, or travelling by train for the selected destination.

- **Multiple Package Options:** Produces several complete packages — differing in hotel, room configuration, and transport — so the group can compare trade-offs before committing.

- **Full Cost Breakdown:** Each package includes a transparent, itemized breakdown covering onward and return transport, accommodation (per night, per room type), food/lump-sum estimates, and total trip cost.

- **End-to-End Itinerary Generation:** Beyond destination suggestion, produces a complete, ready-to-book plan — how to get there, where to stay, what to do, and how to return.

5.3 Proposed Technology Stack

*Table 3. Proposed technology stack by layer.*

| **Layer**    | **Proposed Technology**                                                                                      |
|--------------|--------------------------------------------------------------------------------------------------------------|
| Frontend     | Web/mobile interface for preference input and package comparison                                             |
| Backend      | AI/LLM-based recommendation engine (e.g., Claude or GPT API) combined with rule-based cost-calculation logic |
| Data Sources | Travel, hotel, and transport pricing APIs, or simulated pricing data for the purposes of this class project  |

6\. Expected Output

6.1 Output Characteristics

The final output of TripSync AI is a complete, personalized trip plan rather than a single destination suggestion. For each recommended package, the system outputs:

- A recommended destination (or shortlist), justified against the group’s aggregated preferences and constraints.

- A cost comparison across available transport modes.

- Multiple complete packages, each with a distinct hotel/room/transport combination.

- An itemized cost breakdown per package: transport (to and from), accommodation (per night, per room type), food/lump-sum estimate, and total trip cost.

- A final, day-by-day itinerary for the selected package, covering transport, accommodation, and activities from departure to return.

6.2 Illustrative Example

To demonstrate the expected output, consider a group of three friends with the following inputs:

*Table 4. Sample participant inputs for the illustrative example.*

| **Member** | **Preference**       | **Availability** | **Past Trip**   |
|------------|----------------------|------------------|-----------------|
| Alice      | Beach destinations   | 1st–7th March    | Hawaii          |
| Bob        | Hiking               | 3rd–5th March    | Rocky Mountains |
| Carol      | Cultural experiences | 2nd–6th March    | Paris           |

The group’s common availability window is 3rd–5th March — the overlap of all three members’ available dates. Based on this window and the combined preference set, TripSync AI would suggest San Diego, California as a candidate destination, since it offers beach access (satisfying Alice), nearby hiking trails (satisfying Bob), and cultural and historical sites (satisfying Carol) — all within a single, common travel window. The system would then proceed to steps 4–6 of the methodology: requesting a transport preference, generating multiple hotel/transport packages for San Diego, and producing a final itemized itinerary for the package the group selects.

7\. Objective and Conclusion

The objective of TripSync AI is to demonstrate how AI can reduce a complex, multi-constraint decision problem — one that combines individual preferences, budget, availability, and logistics — into a clear, actionable, and personalized output. By automating preference aggregation, destination recommendation, cost comparison, and itinerary generation, TripSync AI turns group trip planning from a fragmented, manual process into a guided, end-to-end experience. This Phase 1 document establishes the problem statement, input requirements, methodology, and expected output that will inform the design and development of the system in subsequent project phases.
