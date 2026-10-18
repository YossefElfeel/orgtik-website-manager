// Authorized Roadmap examples. These are sample discussions, never attributed to real users.
const discussions = {
  'workspace-guide': [
    'A short checklist would help a new team decide which tools to set up first.',
    'Please include a simple example of how files, tasks, and customer records connect.',
    'It would be useful to show who owns each step during onboarding.',
    'A guide that we can revisit after setup would help new colleagues too.',
  ],
  'request-view': [
    'Seeing the owner and next step together would make support requests easier to follow.',
    'Please distinguish requests waiting for our reply from work already in progress.',
  ],
  'accessible-review': [
    'Please make keyboard navigation part of the review checklist from the start.',
    'A clear focus indicator would help people move between controls without a mouse.',
    'Contrast checks should cover the light and dark layouts.',
    'Please include a reduced-motion check for animations and transitions.',
    'Form labels and helpful validation messages should be included in the review.',
    'It would be useful to see which accessibility checks passed before handover.',
  ],
  'project-summary': [
    'A single place for milestones and decisions would make handovers much easier.',
    'Please keep the current owner and next action visible in the summary.',
    'Links to the final files would help us find the right version after delivery.',
  ],
  'continuity-view': [
    'A simple service-health overview would help us understand what needs attention.',
    'Please show when the last backup was completed.',
    'It would be helpful to see planned maintenance before it begins.',
    'A short explanation of each alert would be easier to follow than a technical code.',
    'Please keep the next recommended action beside the current status.',
    'Knowing who to contact for an issue would make the overview more useful.',
    'A record of completed updates would help us follow changes over time.',
    'Please make the overview easy to read on a phone.',
  ],
  'consent-view': [
    'Consent options should explain clearly what each choice allows.',
    'Please make changing a previous choice as easy as making the first one.',
    'The essential settings should be easy to distinguish from optional ones.',
    'A plain-language explanation would be helpful before enabling analytics.',
    'Please include keyboard access for every option in the panel.',
  ],
  'delivery-checks': [
    'A final checklist would help us review the website before handover.',
    'Please include checks for forms, links, and mobile layouts.',
    'Showing the outcome of each check would make the delivery easier to review.',
  ],
};

export function sampleIdeaComments(id) {
  return (discussions[id] ?? []).map((body, index) => ({
    id: `${id}-comment-${index + 1}`,
    author: `Sample reader ${index + 1}`,
    body,
    sample: true,
  }));
}
