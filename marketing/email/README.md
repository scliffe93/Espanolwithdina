# The outreach email

A cold email to independent Spanish tutors and small language schools, selling them their own copy of the app. It is built to stand out in two ways that survive every email client:

1. **A penalty to take inside the email.** A drawn goal with three verb forms. Tapping one opens the prospect's personal page, which shows ¡GOL! or ¡Parada! and then lets them play the real game for their city's club.
2. **A page made for them.** The button opens `#/pitch?to=…&school=…&city=…` on the live site: their name on the app's brand card, the game, a sample week in their name, what the tutor sees, prices, and a book-a-walkthrough button.

Email clients strip scripts and most of them block forms, so nothing cleverer than links is reliable. Gmail's AMP format would allow real interactivity, but only in Gmail and only after Google approves the sending domain, which is not worth it for one-to-one outreach. The design here degrades to plain links everywhere, including with images switched off.

## Files

| File | What it is |
|---|---|
| `pitch-email.html` | The email. Table-based, inline styles, 600 px wide, stacks on phones. Images are hosted on the live site under `/pitch/`. |
| `pitch-email.txt` | The plain-text version. Send it as the text alternative, or on its own when a prospect's address looks like it belongs to a person who reads mail in plain text. |
| `../../scripts/merge-email.mjs` | Fills both templates for every row of a CSV and writes one `.html` and one `.txt` per prospect. |
| `../../src/data/pitch.ts` | The page's sender details, set-up time and prices. Fill `senderName`, `senderEmail` or `bookingUrl` before sending anything. |

## Before the first send

1. **Fill the placeholders** in both templates: `[about two weeks]`, `[phone]`, `[Your trading name]`, `[postal address]`. Search for `[` to find them.
2. **Fill `src/data/pitch.ts`** (`senderName`, and `bookingUrl` or `senderEmail`), build and push, so the page's "Book a 30-minute walkthrough" button works. Until then the page asks the reader to reply to your email instead.
3. **Keep the site address.** Images and links point at `https://scliffe93.github.io/Espanolwithdina/`. If the repository is renamed or moved to a custom domain, replace that address in both templates (or pass `--base` to the merge script).
4. **Send one to yourself** at a Gmail address and at an Outlook address, on a phone and on a computer, and take the penalty from each.

## Merge fields

| Field | Meaning | Example |
|---|---|---|
| `{{greeting}}` | "Hi Laura," or, with no first name, "Hello," | Hi Laura, |
| `{{school}}` | The business name, or the tutor's own first name for a sole tutor (it appears as "This week with …", exactly as on the page) | Academia Sol |
| `{{city}}` | The Spanish-speaking city whose club the penalty is for, as it reads in "a penalty for {{city}}'s club" | Valencia |
| `{{pitch_url}}` | The personal page link; the merge script builds it | `…/#/pitch?to=Laura&school=Academia%20Sol&city=valencia` |
| `{{sender_name}}` | You | |

The page knows seven cities: `madrid`, `valencia`, `barcelona`, `sevilla`, `cdmx`, `buenosaires`, `medellin`. Pick the one closest to where the tutor's students are heading (a Spanish tutor in Leeds whose students holiday in Valencia gets Valencia). When you do not know, leave it blank: the email and the page both use Madrid.

## Sending

**Option A, one at a time (recommended for the first fifty).** Put the prospects in a CSV with the columns `email, first_name, school, city, city_id`, then:

```
node scripts/merge-email.mjs prospects.csv out/ --sender "Your name"
```

Open each `out/*.html` in Chrome, select all, copy, and paste into a new Gmail or Outlook message: the tables and inline styles survive the paste. Set the subject, send. Thunderbird can also send a file as-is (Insert, HTML). The matching `.txt` is there if you prefer to send plain text to someone.

**Option B, a sending tool.** Brevo, MailerLite and Mailchimp all take pasted HTML and a contact import with custom fields. Rename the merge fields to the tool's own syntax first, for example Brevo's `{{ contact.FIRSTNAME }}`, `{{ contact.SCHOOL }}`, `{{ contact.CITY }}`, `{{ contact.PITCH_URL }}`. Generate the `PITCH_URL` column in your sheet with:

```
="https://scliffe93.github.io/Espanolwithdina/#/pitch?to="&ENCODEURL(B2)&"&school="&ENCODEURL(C2)&"&city="&E2
```

(columns: A email, B first name, C school, D city as it reads, E city id). Turn off the tool's click tracking: wrapped links break the `#/pitch` fragment in some clients, and the footer promises nothing is tracked.

**Pace and deliverability.** Send from a mailbox on your own domain with SPF, DKIM and a DMARC record set up (Google Workspace or Microsoft 365 do the first two for you; add a DMARC record of `p=none` to start), no more than twenty or thirty a day, no tracking pixels, a plain subject line, and always the plain-text part. Replies, even "no thanks", help your sender reputation; silence does not.

## Subject lines

Pick one per batch and keep it:

- `The admin after your last lesson`
- `Two minutes of notes, a week of homework`
- `I built this for one Spanish tutor`

Avoid subjects with a blank or a bracket in them ("tú ___") and anything that promises "a page with your name on it": from a stranger, both read like a broken mail merge or phishing.

Preheader (already in the HTML): *A week's homework from your last lesson, seven games, and one penalty for you to take.*

## Follow-ups

Two at most, both short, both as replies in the same thread.

**Day 4.** "Did the penalty go in? The page is still there: {{pitch_url}}. If it is easier, tell me a day and a time and I will walk you through it with your students' names in it."

**Day 10.** "I will leave it here. If homework between lessons ever becomes the problem you want to fix, the page keeps your name on it. Thanks for reading."

## Staying on the right side of UK email law

The footer is written for this. In short:

- Under PECR, unsolicited marketing email to a **company** (limited company, LLP, public body) at a published business address is allowed as long as you say who you are and give a way to opt out. Most language schools are companies.
- For **sole traders and partnerships**, which most individual tutors are, unsolicited marketing email needs their prior consent. Write to them only where they publish a business address and invite enquiries, keep it personal and one-to-one, and stop the moment they ask. If in doubt, make first contact another way (a reply to a public post, a call, a referral) and send the email once they have said yes.
- Keep a list of everyone who says "no thanks" and never write to them again.
- The privacy link in the footer points at the app's privacy page; the pitch page itself stores nothing and sends nothing.

None of this is legal advice; the ICO's direct marketing guidance is the reference.

## Changing the copy

Edit `pitch-email.html` and `pitch-email.txt` together. The penalty's verb, forms and answer are also defined in `src/data/pitch.ts` (`EMAIL_SHOT`): if you change the form in the email, change it there too, or the page will grade the shot wrongly.
