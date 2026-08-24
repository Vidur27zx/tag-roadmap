export const PHASES = [
  { id: 'brand', name: 'Logo & Wireframes', color: '#B45A38' },
  { id: 'web', name: 'Website Build', color: '#1F2A44' },
  { id: 'android', name: 'Android App', color: '#2F6F5E' },
  { id: 'ios', name: 'iOS App', color: '#7A5C9E' },
  { id: 'scale', name: 'Extra Features', color: '#C99A2E' },
] as const;

const DEFAULT_MILESTONES = [
  { id: 'b1', phase: 'brand', week: 'Now', title: 'Logo', tasks: ['Show 3 logo ideas to client', 'Pick colours & fonts', "Get client's final okay on logo"] },
  { id: 'b2', phase: 'brand', week: 'Now', title: 'Wireframes', tasks: ['Sketch homepage layout', 'Sketch product page layout', 'Sketch cart & checkout layout', "Get client's final okay on wireframes"] },
  { id: 'w1', phase: 'web', week: 'Wk 1–2', title: 'Planning', tasks: ['Kickoff meeting', 'Write down all requirements', 'Get requirements approved'] },
  { id: 'w2', phase: 'web', week: 'Wk 2–4', title: 'Design', tasks: ['Design home & product pages', 'Design cart & checkout', 'Get design approved'] },
  { id: 'w3', phase: 'web', week: 'Wk 4–9', title: 'Core Website', tasks: ['Login & account pages', 'Product search & filters', 'Shopping cart & checkout', 'Billing & invoices', 'Seller dashboard', 'Reviews & ratings', 'Email/SMS alerts', 'Hindi language option'] },
  { id: 'w4', phase: 'web', week: 'Wk 7–11', title: 'GI Tag & Traditions Pages', tasks: ['Map of India with GI products', 'GI certificate checker', 'Artisan profile pages', 'Festivals & events calendar', 'Blog section'] },
  { id: 'w5', phase: 'web', week: 'Wk 10–12', title: 'Payments & Delivery', tasks: ['Connect payment gateway', 'Connect delivery partners', 'Test payments & shipping'] },
  { id: 'w6', phase: 'web', week: 'Wk 12–13', title: 'Testing', tasks: ['Test the whole site', 'Fix bugs found', 'Security check'] },
  { id: 'w7', phase: 'web', week: 'Wk 13–15', title: 'Client Testing', tasks: ['Client tests the site', "Fix client's feedback", 'Client gives final approval'] },
  { id: 'w8', phase: 'web', week: 'Wk 16', title: 'Website Goes Live', tasks: ['Final checks', 'Launch website', 'Watch closely after launch'] },
  { id: 'a1', phase: 'android', week: 'Wk 17–19', title: 'Planning & Design', tasks: ['Plan Android app', 'Design Android screens', 'Get design approved'] },
  { id: 'a2', phase: 'android', week: 'Wk 20–24', title: 'Build Core App', tasks: ['Home & product screens', 'Cart & checkout', 'GI Tag section', 'Traditions section'] },
  { id: 'a3', phase: 'android', week: 'Wk 25–26', title: 'Payments & Delivery', tasks: ['Connect payments', 'Connect delivery tracking'] },
  { id: 'a4', phase: 'android', week: 'Wk 27–28', title: 'Testing & Release', tasks: ['Test on different phones', 'Fix bugs', 'Release app'] },
  { id: 'i1', phase: 'ios', week: 'Wk 29–31', title: 'Setup & Design', tasks: ['Set up iOS project', 'Build core screens'] },
  { id: 'i2', phase: 'ios', week: 'Wk 32–35', title: 'Build Core App', tasks: ['GI Tag section', 'Traditions section', 'Checkout & payments', 'Delivery tracking'] },
  { id: 'i3', phase: 'ios', week: 'Wk 36–38', title: 'Testing & Release', tasks: ['Test on different iPhones', 'Fix bugs', 'Submit to App Store'] },
  { id: 's1', phase: 'scale', week: 'Wk 39–44', title: 'Global Payments & Shipping', tasks: ['International payments', 'International shipping', 'Multiple currencies'] },
  { id: 's2', phase: 'scale', week: 'Wk 45–50', title: 'Extra Features', tasks: ['WhatsApp support chat', 'Seller analytics', 'EMI payment option', 'Photo reviews', 'Faster search'] },
] as const;

export type Status = 'todo' | 'doing' | 'done';

export type Milestone = {
  id: string;
  phase: string;
  week: string;
  title: string;
};

export type TrackerTask = {
  milestoneId: string;
  title: string;
  status: Status;
  by: string;
  at: string;
};

export type BoardData = {
  milestones: Milestone[];
  tasks: Record<string, TrackerTask>;
};

export type TrackerResponse = {
  data: BoardData;
  version: number;
  updatedAt: string;
};

export type TrackerMutation =
  | { kind: 'setStatus'; taskId: string; status: Status; actor: string }
  | { kind: 'renameTask'; taskId: string; title: string }
  | { kind: 'addTask'; milestoneId: string; title: string }
  | { kind: 'deleteTask'; taskId: string }
  | { kind: 'renameMilestone'; milestoneId: string; title: string }
  | { kind: 'setMilestoneWeek'; milestoneId: string; week: string }
  | { kind: 'addMilestone'; phase: string; title: string; week: string }
  | { kind: 'deleteMilestone'; milestoneId: string }
  | { kind: 'validatePassword' };

export const STATUS_ORDER: Status[] = ['todo', 'doing', 'done'];

export function makeDefaultBoard(): BoardData {
  const milestones: Milestone[] = DEFAULT_MILESTONES.map(({ id, phase, week, title }) => ({ id, phase, week, title }));
  const tasks: Record<string, TrackerTask> = {};
  DEFAULT_MILESTONES.forEach((milestone) => {
    milestone.tasks.forEach((title, index) => {
      tasks[`${milestone.id}-${index}`] = {
        milestoneId: milestone.id,
        title,
        status: 'todo',
        by: '',
        at: '',
      };
    });
  });
  return { milestones, tasks };
}

export function phaseFor(id: string) {
  return PHASES.find((phase) => phase.id === id);
}

export function nextStatus(status: Status): Status {
  return STATUS_ORDER[(STATUS_ORDER.indexOf(status) + 1) % STATUS_ORDER.length];
}

export function isStructuralMutation(mutation: TrackerMutation) {
  return mutation.kind !== 'setStatus';
}
