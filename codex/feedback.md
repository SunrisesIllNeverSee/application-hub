# Feedback & Roadmap Notes

---

## ADDENDUM — Claude's Commentary (2026-05-12)

### On the ICP

Got it wrong the first time. The ICP isn't the person filling out applications — it's the programs, schools, accelerators, and grant committees *creating* the applications. They are the customer. The applicant is the product.

Programs are currently running application cycles manually or with expensive, clunky ATS software. What this platform offers them: their application archived and discoverable, questions standardized and indexed, submissions processed and scored automatically, and applicants pre-screened before a human reviewer ever touches them. The applicants are doing the data entry for free because they want to apply. That's the leverage.

This also reframes why free for applicants is the right call — applicant volume is the value proposition to the program. And programs have real budgets. A university, a federal grant committee, an accelerator — they're not thinking about $10/month, they're thinking about what it costs to run an application cycle. That's a completely different revenue ceiling.

### On the Hostile Takeover (ref: 8.1)

This isn't competing with Indeed or Glassdoor. It's making their customers come here instead — because this platform already has a scored, pre-vetted applicant pool sitting in the system before a program even posts. That's the flip. Programs stop broadcasting into the void and start pulling from a live ranked pool.

### On the Onboarding Gate (ref: 1.1)

The gate isn't friction. It's the filter that gives every downstream data point context. "You can't enter until you've submitted an application" means day one you already know who this user is, what they're applying for, and what their answers look like. Everything the system does from that point — scoring, matching, persona building — is grounded in real intent, not a blank profile.

### On Retention (pushback, now resolved)

Earlier I asked what brings a user back tomorrow. The answer is: they already have 9 more applications to fill out. This isn't a product people discover and wonder what to do with. It's the thing you go to when you're already in application mode — a founder in a 60-day accelerator sprint, a PhD student racing grant deadlines, a new grad sending 40 applications. They're already motivated, already in pain, already doing repetitive work. You don't have to manufacture the return visit. The pressure of the application cycle does it.

### On the BYOK Charge (ref: 9.2) — still a mild flag

The reframe helps: it's not "pay to connect your key," it's "pay for the no-friction power lane." The person with API keys is a power user who won't tolerate copy-paste. A one-time unlock for that tier makes sense. Just make sure the framing in the UI reflects that — it should feel like an upgrade, not a gate.

### On the Persona Profile (ref: 3.4) — the headline feature

The three-layer stack is clean: answer bank (raw capture) → persona profile (distilled output) → recruiter scoring (monetization surface). The problem today is all three layers are visible to users on day one before they've built anything, so it feels like a filing cabinet. The onboarding gate fixes this by hiding layers two and three until layer one has substance.

### On the Split-Screen Interface (ref: 9.3)

The overleaf/prism framing is underrated. Left panel: answer bank and persona profile. Right panel: the application being filled. That makes BYOK and draft feel like a coherent workflow rather than a bolted-on feature. Worth prioritizing in the UX rethink.

### On the Archive Seeding (ref: 7.2) — immediately actionable

Top 100 schools, top 50 grant programs, 30-50 job application templates per sector. This is the data moat and it doesn't require any user to show up first. It can start this week. The historic/static framing for job applications also sidesteps the legal headache of scraping live job boards — a historic archive framed as research and reference is a much safer posture and more academically interesting.

### On the Lineage System (ref: 5.1) — underrated moat

First person to submit a URL gets credit, timestamped, locked. That's essentially a prior art system for program discovery. If built right, people will race to submit programs just to claim the lineage — which is free crowdsourced data collection. Nobody else is doing this.

---

---

## 1. Onboarding & First Experience

**1.1** what we have right now is too overwhelming for people... so maybe considering some modifications for easier integration. for example maybe focus on the question and answers first...  i mean think about what we are offering value wise... when they open up their today dash and hub they are overwhelmed with information... so i am thinking about a starting point or initialization type thing... where in order to start we asking them 5-10... those questions will trigger their experience... then in order to begin they will either need to OHHHH i got it... so in order to enter they will either have to fill out "our application" ORRRRR upload an application they are working on... this way they grasp what this is all about then nothing opens up until an application has been submitted... and honestly like i said the system would conform to their answers so even if we have to manually review the initial ones i dont care... just to clarify they fill out our application or they provide their own application and answer 5-10 questions to customise their experience.. what does customise their experience means... well it means not overwhelming them will all of this DATA

**1.2** so i think we focus on Questions, Answers, then applications... because in reality there are very valuable things here between the two... and not to be cheap or greedy i think it would be better to give them less information than more for the basic unpaid...

**1.3** which brings me back for how we are set up or built to handle all applications tech start up, job applications, university, and grants... am i missing any? ANDDDD maybe the way to do this is... when people start the system has a generalized theme.. now users can pay to customize their experience ORRRRRRR their experience/theme grows organically with them so say upload 5 applications the ux will start to gravitate those that, and then 10 would move more, then says 15 or 20 and they receive premium benefits as a result of feeding the system questions they answer

---

## 2. Answer Bank

**2.1** let remove answer bank from the profile section

**2.2** i am having issues with the answer bank not its present functions just how i conceptualized it working... the answer bank should only be answers in a text box form timestamp dated possible hashed... its should be a captured moment... it should i believe have a scrollable index of its contents... similar to vs code and folder file editor...

---

## 3. Profile & User Growth

**3.1** users are creating profiles but we are not giving them anything to do with it.... maybe think of it like github.... giving them a work space and then there is places to reach out... def a later thing

**3.2** so then to bring it back to profiles and users... maybe in the open of the site it will just be stats and information... tracking questions uploaded, answers given, applications filled, hot questions applications or funny answers, maybe leaderboard whose answering questions, providing questions, filling out applications, whose interacting maybe.. maybe rate or rank my answers... maybe thats the community side of... this would be the dashboard

**3.3** also also also... user profiles get abilities maybe... i will say the more they develop the more their profile becomes institutional... ie they get their best answers shown OR a recruiter could point an application at their profile and it would receive a rating not just a fucking match.com % overlap on favorites

**3.4** ACTUALLY THAT WAS ONE OF MY BIG IDEAS IN CHANGING THE FUCKING WORLD INSTEAD OF COWTOWING ALL OVER THE PLACE FILLING OUT APPLICATIONS... WE CREATE THIS SPACE WHERE AS USERS FILL OUT APPLICATIONS THEY DEVELOP A PERSONA PROFILE WHICH WOULD GET TO A STATE WHERE THEY WOULD HAVE TO FILL OUT APPLICATIONS AS MUCH THEIR PERSONA PROFILE WOULD BE ENOUGH... AND ON THE FLIP SIDE PEOPLE HIRING WOULD ACTUALLY HAVE TO PUT IN WORK... NO LONGER IS IT OPEN A POSTING AND SEE WHO SHOWS UP... NO NO NO YOU PUT UP THE JOB POSTING AND APPLICATION AND YOU GET IMMEDIATE SCORING RECOMMENDATIONS BASED ON FILLED OUT APPLICATIONS... NOW THIS DOESNT SAY IMMEDIATE HIRES... HOWEVER IT DOES GET THAT HIT LIST DOWN AND PEOPLE ON THE PHONE RIGHT AWAY... I AM NOT SURE IF I EXPLAINED THIS PART ENOUGH HOWEVER IT BREAKS SOME GATEKEEPING AND LEVELS THE PLAYING FIELD BETWEEN EMPLOYEE AND EMPLOYER

---

## 4. Hub & Opportunity Display

**4.1** maybe for the hub is free tier it just rotates or randomizes 50 opportunities every hour or every 4 6 or 12 hours... the search filter best fit would all be premiums... although people can still search manually for what they want... also feel like there is a better display for this filters of would be tabs across the top should also include check size, equity ask, if this is a payment, travel involved, remote, students only etc... that would be tabs header for the table.... then you would get a column like listing of all the opportunity in a quickview rectangle... then when you click it opens up fully to the right again its a similar concept to most other interfaces

**4.2** for ux overall... i feel like the app hub column should be able to minimize... we will work on a dashboard of sorts....

---

## 5. Program Submission

**5.1** i dont get the whole submit a program... notes should be description... honestly submission should be its own thing... main tab... in theory you either enter a url which would auto file a submission with lineage to block anyone else claiming credit... or upload a pdf or image OR we have a template they take plug in and then send that back and it auto ingests into the system giving them credit... speaking of credits people can transfer their days to others... founders students what have you

---

## 6. The Archive — Worlds First Application Database

**6.1** i just remembered the point of the archive... its to begin to built an archive of applications a collection if you will... seems fucking nuts but there is a lot of information in them... so something i would like not just for tech start ups... we want to collect store create the worlds first database collection of applications for every fucking thing and every version... that may already exist and thats ok but lets do

**6.2** so i am all for creating and archiving the entities, the application, and questions for each topic founder, job seeker, student, or researcher. i only say this because for a second i was going to say fuck tracking job applications but who the fuck knows... what i do know is that i can pretty much automate and or scrape the categories of tech start up, universities, and grants (science, business, scholarships anything else) (public private and federal ?) .... is there any category that i am missing ? ... HOWEVER I WOULD LIKE FOR THE JOB POST TO PRETTY MUCH CREATE ITSELF VIA MANUAL SUBMISSIONS OR BY AGENTS I GUESS... maybe we can create a framework for how it develops right... pipeline when someone submits url or file... the business gets indexed with the application the questions get filed and marked... ooo maybe thats it the job application archive is more of a historic or static archive to learn from... where as the other categories are living offering irl opportunities

---

## 7. Category Breakdown & Seeding

**7.1** we are going to have to split up grants by academic research, scholarly like kid or student for tuition, then business federal and or private... anything else in this situation?

**7.2** ALSO ALSO ALSO... we should note for each category some seeding strategies

- **Universities:** list the following top 100 schools and their application or maybe top 250... maybe we split or categorize by specialties... ie top 25 athletic campus - Science - business - law - tech medical - i dunno what else any suggestions... i guess then there are sub layers of community colleges, 4 year public private ivy, master/graduate degree, then phd.. then there is by location... pull what application we can 20% of each list

- **Grants:** similar science research scholarship business start up then public private federal

- **Jobs:** we list or curate a list of the top companies in different realms federal public and private finance food manufacture tech etc etc etc again only need 30-50 applications to seed the category

---

## 8. Jobs & Competitive Landscape

**8.1** which brings me back to the job situation... i dont want to technically get involved right now in providing the type of job stuff that indeed and glassdoor does bc they already have that... MAYBE THOUGH people can connect their profiles.... think about this please brainstorm and trouble shoot.... i think that is not a realm we want to get involved with unless a partnership is formed with one of those companies... so part of the brainstorm is taking away... or how we can integrate especially mobile with those systems so users find it friendly... brainstorm please and thank you... OHHHH RIGHT so the point of that is to say i think it better of leaning into archiving applications... when it comes to the job market and the other companies we arent interested in hosting job posts UNLESS companies are paying us to do so specific to processing their applications and hosting them ;) how would that hostile takeover work... fuck everyone will be so pissed....

**8.2** also also... lets run recon on all job hosting sites monster indeed linkedin glassdoor... then any type of off shoot company or business be it resume writing or anything i dunno just so we know who to target and scrape jobs from and also offer partnerships too oh right companies like greenhouse and other career hr job application posting hosting sites...

---

## 9. Monetization & Feature Gating

**9.1** not to be cheap or greedy i think it would be better to give them less information than more for the basic unpaid...

**9.2** my other idea, not to be cheap or greedy is that maybe to charge in order to hook up or connect your keys... say $10... because i am thinking we can make copy and paste injection a lot easier for the site... so i think you might be able to start to see what i am showing and leaning towards... i guess its monetizing the features... so and because 1) i am not expecting people to do their work in here- 2) i will assume or provide easy copy and paste into their preferred work llm... then we capture the rest... 3) i am envisioning something similar to latex situations where you work on one side and the output shows on the other... so a set up like overleaf or prism

---

## 10. Infrastructure & Data Architecture

**10.1** sounds like i maybe need an interesting database setup for this... one where i have a dashboard that develops with the user... however is accessing or pulling the data needed from an outside source a databank... this way its not bogged down by everything and it can use its storage for the experience with the user
