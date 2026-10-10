**PROJECT SYNOPSIS**

**BonVoyage: An AI-Assisted Collaborative Trip Planner**

**for Group Travel Decision Support**

Course: Software Engineering

Department of Computer Science and Engineering

School of Engineering and Technology, BML Munjal University

Academic Session 2026

**Table 1: Details of group members**

| **S. No.** | **Name of Student** | **Enrolment No.** | **Section** | **Programme** |
|------------|---------------------|-------------------|-------------|---------------|
| 1          | Maulik Gupta        | 240532            | CSE4        | B.Tech. CSE   |
| 2          |                     |                   |             |               |
| 3          |                     |                   |             |               |
| 4          |                     |                   |             |               |

**1. TITLE OF THE PROJECT**

BonVoyage: An AI-Assisted Collaborative Trip Planner for Group Travel Decision Support.

The title identifies the three ideas the project rests on. It is collaborative because the system takes input from every member of a travelling group rather than from one organiser acting on everyone's behalf. It is AI-assisted rather than AI-driven, since the artificial intelligence component ranks and explains options while the final choice stays with the group. And it is framed as decision support rather than booking, because the difficulty this project addresses lies in reaching a decision the whole group accepts, not in completing a transaction once that decision has been made.

**2. INTRODUCTION**

Trip planning is one of the most common decision-making tasks people carry out online, and for a single traveller it is largely a solved problem. Established platforms let an individual search destinations, compare fares, filter hotels by price and rating, and complete a booking in a few minutes. The experience breaks down as soon as more than one person is involved. A group of four friends planning a short holiday must reconcile four sets of interests, four budgets, and four calendars before any of that search machinery becomes useful, and none of the mainstream platforms helps with that part of the work.

What usually happens instead is familiar to anyone who has tried it. A long message thread forms, someone shares a list of possible destinations, opinions arrive at different times and in different formats, a shared spreadsheet is created and then abandoned, and one motivated member ends up doing the research and the negotiation alone. The outcome is often a plan that reflects whoever was most persistent rather than whoever had the strongest case, or no plan at all. Studies of group decision support describe this as a coordination problem rather than an information problem, and the distinction matters because more search results do not make it easier.

The research community has studied this class of problem for over two decades under the heading of group recommender systems, which extend conventional recommendation by aggregating the preferences of several users into a single group model. That literature has produced well-understood aggregation strategies and a good deal of evidence about how groups respond to them. At the same time, the recent availability of large language models has made it possible to generate fluent, detailed itineraries from a short natural-language description, which has attracted considerable commercial interest. The two developments have not yet been brought together carefully, and there is good evidence that language models on their own handle multi-constraint travel planning poorly.

BonVoyage is proposed as a system that combines the two approaches deliberately. Structured preferences are collected from every member, hard constraints such as budget, dates, and travel radius are enforced arithmetically before any generation takes place, candidate destinations are ranked by a scoring function that balances overall group satisfaction against the satisfaction of the least well-served member, and a language model is then used only to assemble and explain a plan whose factual content has already been fixed. The remainder of this synopsis states the problem formally, reviews the relevant literature, identifies the gap the project addresses, sets out the proposed methodology and data sources, and describes the expected outcomes, scope, and schedule of the work.

**3. PROBLEM STATEMENT**

Existing travel platforms optimise for an individual user with a known destination and known dates. Group travel violates both assumptions. Members disagree on where to go, they can afford different amounts, and their free dates overlap only partially or sometimes not at all. Reconciling these differences by hand is slow, it places the burden on a single organiser, and it produces decisions that are difficult to justify to the members whose preferences were not met. The problem this project addresses is therefore the automated reconciliation of conflicting individual travel constraints into a small set of complete, costed, and explainable trip options.

The task can be stated more precisely. Let a group consist of n members. Each member submits a preference profile covering destination types, activities, and climate, an availability interval, and a personal budget range. The group additionally supplies an origin, an intended duration in nights, a total budget ceiling, and a maximum travel radius. A candidate destination is feasible when it satisfies all of the following conditions simultaneously:

*dist(origin, d) ≤ R ∧ cost(d, D, n) ≤ B ∧ \[a₁, b₁\] ∩ … ∩ \[aₙ, bₙ\] ≠ ∅*

The first condition keeps the destination within the agreed travel radius, the second keeps the estimated cost of the trip within the group budget for the given duration and party size, and the third requires the intersection of every member's availability interval to be non-empty so that a common travel window actually exists. Any destination that fails even one of these conditions is not a weaker recommendation, it is simply not an option, and the system must treat it that way.

Among the destinations that remain, the system must select and rank those that best satisfy the combined soft preferences of the group. This is where the difficulty lies. Maximising the average satisfaction of a group can leave one member consistently unhappy, while protecting the least satisfied member can produce bland compromises that nobody is enthusiastic about. A workable system has to balance the two, and it has to be able to explain the balance it struck, because a recommendation that a group cannot interrogate is a recommendation they will not trust.

**4. OBJECTIVES**

The project is organised around the following objectives:

1.  **Structured preference elicitation:** To design a structured preference elicitation interface that captures destination type, activity interests, climate preference, budget range, availability window, travel style, and past-trip history from every member of a travelling group.

2.  **Group model construction:** To construct an aggregated group model from the individual submissions, including the computation of the common availability window and the explicit detection and reporting of constraints that cannot be satisfied together.

3.  **Hard constraint enforcement:** To implement a filtering stage that eliminates infeasible destinations arithmetically, before any ranking or generation is attempted, using travel radius, total budget, and trip duration as hard constraints.

4.  **Group-fit scoring:** To design and implement a group-fit scoring function that combines average member satisfaction, the satisfaction of the least well-served member, and a penalty for disagreement, and to compare its behaviour against standard aggregation strategies.

5.  **Package generation and transparent costing:** To generate several complete trip packages that differ in accommodation, room configuration, and transport mode, each supported by an itemised cost breakdown produced through rule-based calculation rather than generative estimation.

6.  **Grounded itinerary generation:** To produce day-wise itineraries using a large language model that is supplied with verified structured facts as grounding data, and to keep every generated plan open to modification or rejection by the group.

7.  **Explainability:** To accompany each recommendation with a statement of the preferences it satisfies and those it does not, so that the group can see the reasoning behind the compromise being proposed.

8.  **Empirical evaluation:** To evaluate the system on the proportion of generated plans that satisfy all stated hard constraints, and on perceived satisfaction and fairness reported by student groups who use it to plan a real trip.

**5. LITERATURE REVIEW**

The work relevant to this project falls into four strands: the theory of group recommendation, the application of recommender systems to tourism, the recent use of large language models for planning tasks, and the current state of commercial trip-planning products.

**5.1 Group Recommender Systems and Preference Aggregation**

Group recommender systems extend conventional recommendation by producing suggestions for several users at once. Jameson and Smyth \[1\] identify three broad designs: computing recommendations for each member and merging the results, aggregating member preferences into a single group profile before recommending, and learning a group model directly. Masthoff \[2\] catalogues the aggregation strategies available for the second approach, drawing many of them from social choice theory. The average strategy takes the mean of member ratings and works well when tastes are similar. Least misery takes the minimum, protecting the least satisfied member, and was adopted by PolyLens \[3\], one of the earliest deployed group recommenders. Most pleasure takes the maximum and tends to favour the most enthusiastic member. Masthoff also notes that the median strategy is resistant to manipulation, since a member cannot steer the outcome by submitting deliberately extreme ratings, whereas least misery is vulnerable to exactly that tactic.

Later work has examined what these strategies leave out. Felfernig and colleagues \[4\] observe that simple aggregation functions oversimplify group dynamics and ignore the history of the decision process, and that no general rule specifies which strategy suits which situation. Fairness has emerged as a distinct concern, since repeatedly satisfying the same members produces recommendations that are individually defensible but collectively unjust. Preference elicitation for groups has also been studied in its own right by Garcia and colleagues \[5\], who show that the method used to collect preferences materially affects the quality of the group recommendation that follows.

**5.2 Recommender Systems in the Tourism Domain**

Borràs, Moreno and Valls \[6\] survey intelligent tourism recommenders and find that the field has concentrated on suggesting points of interest and activities to individual travellers, typically using ontologies, clustering, and planning techniques. Their survey identifies group recommendation and the handling of practical constraints as areas needing further work. Garcia, Sebastia and Onaindia \[7\] address the group case directly, designing a tourism recommender that produces suggestions for both individuals and groups, and demonstrating that a group-aware design produces different and generally more acceptable recommendations than simply averaging individual outputs. More recent reviews of the tourism domain \[8\] confirm that personalisation has advanced considerably while multi-user reconciliation has not.

**5.3 Large Language Models for Travel Planning**

The most directly relevant recent evidence comes from TravelPlanner, a benchmark introduced by Xie and colleagues \[9\] to test whether language agents can plan realistic multi-day trips. The benchmark provides a sandbox with nearly four million data records and over a thousand curated planning problems, and evaluates plans on delivery, commonsense constraints, and hard constraints. The headline result is sobering: GPT-4 achieved a final success rate of 0.6 per cent, with agents struggling to stay on task, select appropriate tools, and hold multiple constraints in view simultaneously. The authors conclude that current language agents are not yet capable of this class of planning on their own.

Work on combining language models with group recommendation is newer and largely exploratory. Lubos and colleagues \[10\] survey the ways language models could support group recommenders, noting their promise for interpreting free-form preferences, mediating conflicting critiques, and generating explanations that describe compromises in natural language. Jannach and colleagues \[11\] argue for a broader rethinking of group recommender systems in the era of generative AI, moving from one-shot recommendations towards agentic decision support. Tommasel \[12\] examines fairness in language-model-generated group recommendations and finds reason for caution, since generated recommendations can over-represent dominant preferences within a group.

**5.4 Commercial Trip-Planning Platforms**

Among deployed products, Wanderlog \[13\] is the closest comparison, offering collaborative itinerary building, route optimisation, expense tracking, and AI-assisted planning. Its collaboration model is nevertheless a shared document rather than a preference reconciliation mechanism: members can edit the same plan, but the system does not collect structured preferences or reason about conflicts between them. Indian platforms such as EaseMyTrip \[14\] and MakeMyTrip \[15\] offer wide transactional coverage of flights, hotels, buses, trains, and pre-assembled group packages, but they operate after the destination decision has been taken rather than helping a group reach it.

**Table 2: Summary of reviewed literature and its relation to the present work**

| **Source**                                             | **Focus**                                               | **Contribution**                                                                                            | **Limitation for the present problem**                                                         |
|--------------------------------------------------------|---------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| Jameson and Smyth \[1\]; Masthoff \[2\]                | Group recommendation theory                             | Classifies aggregation designs and strategies including average, least misery and most pleasure             | Developed for ratings over items; does not address joint budget, date and distance feasibility |
| O'Connor et al. \[3\]                                  | PolyLens group recommender                              | First deployed group recommender; applies least misery and shows per-member predictions                     | Single-domain and rating-based; no cost or scheduling constraints                              |
| Felfernig et al. \[4\]                                 | Group decision support                                  | Notes that aggregation functions oversimplify group dynamics and that strategy selection is unresolved      | Offers no operational method for constrained travel planning                                   |
| Garcia et al. \[5\], \[7\]                             | Preference elicitation and tourism group recommendation | Shows elicitation method affects recommendation quality; designs a group tourism recommender                | Focuses on activities and points of interest rather than complete costed trips                 |
| Borràs et al. \[6\]                                    | Survey of tourism recommenders                          | Comprehensive review of AI techniques applied to tourism                                                    | Confirms that group settings and practical constraints remain underexplored                    |
| Xie et al. \[9\]                                       | TravelPlanner benchmark                                 | Demonstrates that language agents fail multi-constraint travel planning, with GPT-4 at 0.6 per cent success | Evaluates single-user planning; does not consider group preference conflict                    |
| Lubos et al. \[10\]; Jannach et al. \[11\]             | Language models in group recommendation                 | Map out how generative models could support elicitation, mediation and explanation                          | Position and survey work; no implemented, constraint-checked travel system                     |
| Tommasel \[12\]                                        | Fairness of generated group recommendations             | Finds that generated group recommendations can favour dominant preferences                                  | Diagnostic rather than corrective; no mitigation pipeline proposed                             |
| Wanderlog \[13\]; EaseMyTrip \[14\]; MakeMyTrip \[15\] | Commercial platforms                                    | Provide collaborative editing, broad inventory and packaged tours                                           | Support collaboration or transaction, not structured reconciliation of member preferences      |

**6. RESEARCH GAP**

Reading the four strands together, a consistent gap appears. The theory of group recommendation is mature but was developed for a setting in which members rate items on a common scale and the system selects among them. Travel planning is not that setting. A destination is not simply liked or disliked; it is affordable or not, reachable or not, and available on the group's shared dates or not, and these are conditions that must be checked arithmetically rather than scored. Conversely, the language-model literature has produced systems that generate rich, readable itineraries but that fail precisely on the constraint satisfaction the travel domain demands, as the TravelPlanner results make clear. Commercial products sit on a third side of the gap, offering collaboration and inventory without any reconciliation logic at all.

The specific gaps this project addresses are as follows:

1.  Aggregation strategies from the group recommendation literature have been studied for item ratings but not for joint feasibility over budget, calendar, and distance, where a single violated condition disqualifies an option entirely rather than lowering its score.

2.  Tourism recommenders largely produce suggestions at the level of destinations or attractions, stopping short of a complete, costed, bookable package that accounts for transport to and from the destination, accommodation configuration, and daily expenses.

3.  Language models generate itineraries fluently but satisfy hard constraints unreliably, which means that generation must be subordinated to a verified data layer rather than trusted to produce factual content on its own.

4.  Explanations in deployed group systems remain rating-based and rarely articulate the compromise that was made, even though the acceptability of a group recommendation depends heavily on whether the members can see why it was chosen.

5.  Fairness within a travelling group, in the sense of preventing the same member from being repeatedly under-served across successive recommendations, has been identified as a risk in generated recommendations but is seldom operationalised.

6.  Very little published work targets domestic Indian group travel specifically, where road and rail dominate, fare data is fragmented across operators, and per-person cost transparency matters a great deal to the student and young-traveller segment.

BonVoyage is positioned exactly at the intersection of these gaps. It applies group aggregation theory to a domain with hard feasibility conditions, it uses generation only where generation is safe, and it treats explanation and cost transparency as requirements rather than as presentation details.

**7. PROPOSED METHODOLOGY**

**7.1 Overall Approach**

The system is organised as a pipeline in which each stage narrows the space of possibilities and passes a verified result to the next. The ordering is deliberate: arithmetic filtering happens before scoring, scoring happens before package assembly, and generative text is produced last, once every factual value it will refer to has already been established. Figure 1 shows the sequence and the points at which external data enters.

<img src="media/cddb9366dbeb81bfe4acd203441c0c6349526fc9.png" style="width:6.25in;height:4.19792in" />

**Figure 1: Proposed methodology of the BonVoyage collaborative trip planner**

**7.2 Preference Elicitation and Group Model Construction**

Each member submits a profile through a structured form rather than free text, using fixed vocabularies for destination type, activities, and climate, and numeric ranges for budget and availability. The structure is what makes later aggregation possible, since comparable fields can be combined arithmetically while free-form opinions cannot. From the submitted profiles the system computes the common availability window as the intersection of all member intervals, derives an aggregated budget band, and builds a weighted interest vector over destination and activity categories. Where the intersection of availability is empty, or where one member's maximum budget lies below what the group as a whole requires, the conflict is reported explicitly, naming the members whose inputs are in tension, rather than being silently averaged away.

**7.3 Hard Constraint Filtering**

Every candidate destination in the catalogue is tested against the three feasibility conditions stated in Section 3. Distance is computed from the group's origin using a routing service, estimated cost is derived for the given duration and party size, and the trip is checked against the common availability window. Destinations failing any condition are removed. If fewer than three candidates survive, the system reports which constraint was most restrictive and offers the nearest alternatives that would qualify if that constraint were relaxed, since telling a group that no destination fits is less useful than telling them that raising the budget by a stated amount would open up several.

**7.4 Group-Fit Scoring and Ranking**

Surviving candidates are ranked by a group-fit score. Let sᵢ(d) denote the match between member i and destination d, computed as the similarity between that member's interest vector and the attribute vector of the destination, normalised to the unit interval. The score for a destination is defined as:

*GFS(d) = α · (1/n) Σᵢ sᵢ(d) + β · minᵢ sᵢ(d) − γ · σ(s(d))*

The first term is the average strategy, rewarding destinations that satisfy the group broadly. The second is the least-misery term, raising the score of destinations that leave no member badly served. The third subtracts the standard deviation of member scores, penalising destinations that are excellent for some members and poor for others even when the average is acceptable. The weights α, β and γ are configurable, which allows the behaviour of the function to be compared empirically against pure average and pure least-misery baselines during evaluation. A fairness adjustment is also applied across successive recommendation rounds within the same trip, raising the weight given to any member whose score has been lowest in previous rounds, so that the same person is not repeatedly asked to compromise.

**7.5 Package Generation and Cost Estimation**

For a selected destination the system compares the supported transport modes of bus, train, and rented or self-driven car, estimating travel time and cost for the whole group. It then assembles at least three packages differing in accommodation, room configuration, and transport combination. Costs are computed by a rule-based engine rather than generated, covering onward transport, return transport, accommodation per night and per room type, food and local expenses, and activities, and every package is presented both as a group total and as a per-person figure. Where live fare data is unavailable, the calculation falls back to a curated representative dataset and the affected figure is labelled accordingly, so that the user always knows the provenance of a number.

**7.6 Grounded Itinerary Generation**

Only at this point is a language model involved. The structured facts of the selected package, comprising verified places, distances, opening hours, and the costs already computed, are supplied to the model as grounding data, and the model is asked to arrange them into a day-wise plan and to articulate why the package suits the group. The model is not permitted to originate prices, distances, or availability. Any activity that cannot be verified against retrieved place data is either omitted or flagged as unverified, and members may edit, reorder, or remove any item, with the edited version replacing the generated one. This arrangement is a direct response to the TravelPlanner findings: generation is used for the task it performs well, which is composition and explanation, and withheld from the task it performs badly, which is constraint satisfaction.

**7.7 Evaluation Plan**

Evaluation proceeds along two axes. The objective axis measures the proportion of generated plans that satisfy every stated hard constraint, tested against a set of synthetic group scenarios with known feasible solutions, and compares the proposed scoring function against average-only and least-misery-only baselines on the distribution of member satisfaction. The subjective axis asks student groups who use the system to plan a real trip to report, on a short questionnaire, how well the recommendation reflected their own preferences, whether they felt the compromise was fair, and whether the explanation was convincing. Reporting both axes matters, because a plan can be technically feasible and still be rejected by the group that has to live with it.

**8. DATASET AND DATA COLLECTION**

**8.1 Destination Catalogue**

The project will compile a curated catalogue of approximately 120 to 150 domestic destinations reachable from northern India by road or rail. Each entry will record geographic coordinates, destination type, characteristic activities, an indicative daily cost band, and seasonal suitability. The catalogue will be assembled from publicly available tourism board listings and mapping data and stored in the project database, so that filtering and ranking can run without depending on a live external call for every query.

**8.2 External and Cached Data**

Live data will be retrieved through third-party interfaces for geocoding, distance and route computation, place details, and accommodation options, with responses cached to keep usage within quota. Fare and availability data for Indian bus and rail operators is fragmented and not uniformly accessible, so a representative fare dataset will be maintained as a documented fallback. Any figure derived from the fallback will be labelled as an estimate in the interface, and the distinction between retrieved and estimated values will be preserved in the database rather than lost at presentation time.

**8.3 User-Generated Preference Data**

The primary dataset for evaluation will be generated by the system's own users. The target is ten to twenty student groups of between three and six members each, planning a trip they genuinely intend to take. Each participant contributes a preference profile, and each group contributes its selections, revisions, and final questionnaire responses. This data is the only reliable source of evidence about whether the compromises the system proposes are acceptable to the people affected by them.

**8.4 Evaluation Scenarios**

A complementary set of synthetic group scenarios will be constructed, following the constraint-template approach used in the TravelPlanner benchmark \[9\]. Each scenario specifies member profiles, availability intervals, budgets, and a group constraint set for which the feasible solutions are known in advance, allowing hard-constraint satisfaction to be measured objectively without waiting for user studies to complete.

**8.5 Ethical Considerations**

Participation in the user study will be voluntary and informed. Only the data required for planning will be collected, preference profiles will be visible to the owning member and, in aggregated form, to their own group alone, credentials will be stored as salted hashes, and participants will be able to delete their data on request. No payment information is collected at any stage, since the system does not transact.

**9. TOOLS AND TECHNOLOGIES**

The technology choices favour components the team can operate confidently within a single semester, and keep provider-specific logic isolated so that a data source can be replaced without disturbing the recommendation logic. Table 3 summarises the intended stack.

**Table 3: Tools and technologies proposed for implementation**

| **Layer**             | **Technology**                                                   | **Purpose**                                                                                             |
|-----------------------|------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Frontend              | React with TypeScript                                            | Preference forms, ranked shortlist, package comparison and itinerary views, responsive to mobile widths |
| Backend               | Node.js with Express, or FastAPI                                 | REST API, authentication, orchestration of the planning pipeline                                        |
| Database              | PostgreSQL                                                       | Users, trips, members, preferences, destinations, packages, cost items and itineraries                  |
| Filtering and ranking | Python with NumPy and scikit-learn                               | Distance and budget filtering, similarity computation, group-fit scoring                                |
| Generative component  | Large language model accessed through a hosted API               | Itinerary composition and explanation, constrained by supplied grounding data                           |
| Geospatial services   | Maps platform routing and places interfaces                      | Geocoding, distance and travel-time estimation, place details                                           |
| Travel data           | Hotel and travel data interfaces with a curated fallback dataset | Accommodation options and indicative fares, with labelled estimates where live data is unavailable      |
| Version control       | Git and GitHub                                                   | Source control, branch-based development and review                                                     |
| Testing               | Jest or PyTest, with Postman for API testing                     | Unit and integration testing of constraint logic and endpoints                                          |
| Deployment            | Vercel, Render or an equivalent free-tier host                   | Demonstration deployment for the user study                                                             |

**10. EXPECTED OUTCOMES**

On completion, the project is expected to deliver the following:

1.  A working web application in which a group can create a trip, collect structured preferences from every member, and obtain a ranked shortlist of feasible destinations.

2.  A constraint-filtering component that provably excludes destinations violating the budget, duration, or radius conditions, together with diagnostic output identifying the binding constraint when few or no candidates survive.

3.  An implemented group-fit scoring function with configurable weights, and measured evidence of how its satisfaction distribution compares with pure average and pure least-misery aggregation.

4.  At least three complete trip packages per selected destination, each carrying an itemised cost breakdown presented both as a group total and per person, with retrieved and estimated figures clearly distinguished.

5.  A day-wise itinerary generated from verified structured data, accompanied by an explanation of which member preferences the plan satisfies and which it does not.

6.  A documented destination catalogue and fallback fare dataset that can be reused or extended by subsequent projects.

7.  Quantitative results on hard-constraint satisfaction across the synthetic evaluation scenarios, and questionnaire results on perceived satisfaction and fairness from the participating student groups.

8.  Complete project documentation comprising the feasibility study, software requirements specification, design artefacts, and the final project report.

**11. SCOPE OF THE PROJECT**

The scope is bounded deliberately, since the value of the project lies in doing the reconciliation problem properly rather than in reproducing the transactional breadth of existing travel platforms.

The following are within scope:

- Group creation, member invitation, and structured preference and availability collection.

- Hard-constraint filtering over travel radius, total budget, and trip duration.

- Group-fit ranking of destinations with explanation of the compromise reached.

- Comparison of bus, train, and car transport modes with estimated cost and travel time.

- Generation of multiple packages with itemised, rule-based cost breakdowns.

- Day-wise itinerary generation grounded in verified data, with full editing by the group.

- Evaluation with synthetic scenarios and a user study involving student groups.

The following are outside the scope of this version:

- Payment processing, ticketing, and guaranteed reservations. The system produces plans that users book elsewhere.

- Real-time inventory and live seat or room availability across all Indian operators, which is not uniformly accessible.

- International travel, visa guidance, and currency conversion.

- Native mobile applications, since the interface is delivered as a responsive web application.

- Large-scale deployment and commercial operation, which lie beyond the resources of an academic prototype.

**12. PROJECT TIMELINE**

The work is planned across twenty weeks in four phases, structured so that a demonstrable system exists before the more experimental components are attempted. Table 4 lists the phases and their deliverables, and Figure 2 shows the schedule of individual activities.

**Table 4: Project phases, activities and deliverables**

| **Phase**                          | **Weeks** | **Principal activities**                                                                                         | **Deliverable**                                      |
|------------------------------------|-----------|------------------------------------------------------------------------------------------------------------------|------------------------------------------------------|
| Phase 1: Foundation                | 1 to 3    | Requirements consolidation, system design, destination catalogue compilation, database schema                    | Design documentation and populated catalogue         |
| Phase 2: Core system               | 3 to 9    | Backend scaffolding, authentication, trip and group management, preference and availability collection           | Working preference collection flow                   |
| Phase 3: Planning engine           | 8 to 15   | Group model, hard-constraint filtering, group-fit scoring, transport comparison, cost engine, package generation | End-to-end recommendation and package flow           |
| Phase 4: Generation and validation | 14 to 20  | Grounded itinerary generation, integration, testing, evaluation study, documentation                             | Complete system, evaluation results and final report |

<img src="media/e63baf28b7b99cf19dd92dbe6f4619c266f10881.png" style="width:6.25in;height:3.27083in" />

**Figure 2: Week-wise schedule of project activities**

**13. REFERENCES**

\[1\] A. Jameson and B. Smyth, “Recommendation to groups,” in The Adaptive Web: Methods and Strategies of Web Personalization, P. Brusilovsky, A. Kobsa and W. Nejdl, Eds. Berlin: Springer, 2007, pp. 596–627.

\[2\] J. Masthoff, “Group recommender systems: Aggregation, satisfaction and group attributes,” in Recommender Systems Handbook, 2nd ed., F. Ricci, L. Rokach and B. Shapira, Eds. Boston, MA: Springer, 2015, pp. 743–776.

\[3\] M. O’Connor, D. Cosley, J. A. Konstan and J. Riedl, “PolyLens: A recommender system for groups of users,” in Proc. 7th European Conf. on Computer Supported Cooperative Work (ECSCW), Bonn, Germany, 2001, pp. 199–218.

\[4\] A. Felfernig, L. Boratto, M. Stettinger and M. Tkalčič, Group Recommender Systems: An Introduction. Cham: Springer, 2024.

\[5\] I. Garcia, S. Pajares, L. Sebastia and E. Onaindia, “Preference elicitation techniques for group recommender systems,” Information Sciences, vol. 189, pp. 155–175, 2012.

\[6\] J. Borràs, A. Moreno and A. Valls, “Intelligent tourism recommender systems: A survey,” Expert Systems with Applications, vol. 41, no. 16, pp. 7370–7389, 2014.

\[7\] I. Garcia, L. Sebastia and E. Onaindia, “On the design of individual and group recommender systems for tourism,” Expert Systems with Applications, vol. 38, no. 6, pp. 7683–7692, 2011.

\[8\] A. D. Solano-Barliza et al., “Recommender systems applied to the tourism industry: A literature review,” Cogent Business and Management, vol. 11, no. 1, art. 2367088, 2024.

\[9\] J. Xie, K. Zhang, J. Chen, T. Zhu, R. Lou, Y. Tian, Y. Xiao and Y. Su, “TravelPlanner: A benchmark for real-world planning with language agents,” in Proc. 41st Int. Conf. on Machine Learning (ICML), PMLR vol. 235, 2024, pp. 54590–54613.

\[10\] S. Lubos, A. Felfernig, T. N. T. Tran, V.-M. Le, D. Garber, M. Henrich, R. Willfort and J. Fuchs, “Towards LLM-enhanced group recommender systems,” in Proc. 12th Joint Workshop on Interfaces and Human Decision Making for Recommender Systems (IntRS), 2025.

\[11\] D. Jannach, A. Delić, F. Ricci and M. Zanker, “Rethinking group recommender systems in the era of generative AI: From one-shot recommendations to agentic group decision support,” arXiv:2507.00535, 2025.

\[12\] A. Tommasel, “Fairness matters: A look at LLM-generated group recommendations,” in Proc. 18th ACM Conf. on Recommender Systems (RecSys), 2024, pp. 993–998.

\[13\] Wanderlog, “About us and collaborative trip planning.” \[Online\]. Available: https://wanderlog.com/help/about-us/

\[14\] EaseMyTrip, “India travel services.” \[Online\]. Available: https://www.easemytrip.com/c/in/

\[15\] MakeMyTrip, “Group packages.” \[Online\]. Available: https://www.makemytrip.com/holidays-india/group-packages.html

\[16\] Google Maps Platform, “India pricing and billing information.” \[Online\]. Available: https://developers.google.com/maps/billing-and-pricing/india

\[17\] Amadeus for Developers, “Self-service API documentation and test data guidance.” \[Online\]. Available: https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/faq/

\[18\] Booking.com, “Demand API overview.” \[Online\]. Available: https://developers.booking.com/demand/docs/getting-started/overview
