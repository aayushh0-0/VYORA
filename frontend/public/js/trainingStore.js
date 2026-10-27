/**
 * Special Training athlete store (localStorage).
 * Ported from Pace demo data — keys prefixed vyora_pace_ so diet/plan data is untouched.
 */
(function (global) {
  const PREFIX = 'vyora_pace_';

  const seedActivities = [
    { id: 1, type: 'Run', title: 'Morning tempo run', date: '2026-10-27', distance: 6.42, duration: 1880, elevation: 48, pace: '4:52', kudos: 18, notes: 'Strong finish on the final kilometre.' },
    { id: 2, type: 'Ride', title: 'City loop', date: '2026-10-25', distance: 24.8, duration: 3610, elevation: 210, pace: '24.7 km/h', kudos: 32, notes: 'Easy endurance ride.' },
    { id: 3, type: 'Run', title: 'Recovery miles', date: '2026-10-23', distance: 4.1, duration: 1510, elevation: 22, pace: '6:08', kudos: 9, notes: 'Kept the effort relaxed.' },
    { id: 4, type: 'Hike', title: 'Weekend trail', date: '2026-10-20', distance: 8.7, duration: 6840, elevation: 380, pace: '13:06', kudos: 24, notes: 'Beautiful trail and great views.' }
  ];

  const seedChallenges = [
    { id: 1, name: 'October 50K', desc: 'Run 50 km this month', progress: 31.2, target: 50, unit: 'km', joined: true, ends: 'Oct 31' },
    { id: 2, name: 'Climb Higher', desc: 'Gain 1,000 m elevation', progress: 620, target: 1000, unit: 'm', joined: false, ends: 'Nov 08' },
    { id: 3, name: 'Consistency Club', desc: 'Complete 12 activities', progress: 8, target: 12, unit: 'activities', joined: true, ends: 'Nov 15' }
  ];

  const seedProfile = {
    name: 'Alex Morgan',
    handle: '@alexmoves',
    location: 'New Delhi, India',
    bio: 'Run, ride, explore. Chasing consistency over perfection.',
    goal: 'Build endurance',
    weeklyGoal: 25
  };

  const leaderboard = [
    ['Maya Chen', 'MC', 42.6, 6],
    ['Alex Morgan', 'AM', 38.1, 5],
    ['Jordan Lee', 'JL', 33.4, 5],
    ['Sam Rivera', 'SR', 28.9, 4],
    ['Priya Shah', 'PS', 24.2, 4]
  ];

  const segmentEfforts = [
    ['Maya Chen', '03:42', '4:02 /km'],
    ['Alex Morgan', '03:56', '4:17 /km'],
    ['Jordan Lee', '04:04', '4:25 /km'],
    ['Sam Rivera', '04:19', '4:42 /km'],
    ['Priya Shah', '04:31', '4:55 /km']
  ];

  function read(key, seed) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw == null) return structuredClone(seed);
      return JSON.parse(raw);
    } catch {
      return structuredClone(seed);
    }
  }

  function persist(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  }

  function formatDuration(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  function getActivities() {
    return read('activities', seedActivities);
  }

  function saveActivities(list) {
    persist('activities', list);
  }

  function getChallenges() {
    return read('challenges', seedChallenges);
  }

  function saveChallenges(list) {
    persist('challenges', list);
  }

  function getProfile() {
    return read('profile', seedProfile);
  }

  function saveProfile(profile) {
    persist('profile', profile);
  }

  function addActivity(activity) {
    const list = getActivities();
    const next = {
      id: Date.now(),
      kudos: 0,
      notes: activity.notes || 'Recorded in Special Training (simulated session).',
      ...activity
    };
    list.unshift(next);
    saveActivities(list);
    return next;
  }

  function resetDemo() {
    ['activities', 'challenges', 'profile'].forEach((key) => localStorage.removeItem(PREFIX + key));
  }

  global.VyoraTrainingStore = {
    getActivities,
    saveActivities,
    getChallenges,
    saveChallenges,
    getProfile,
    saveProfile,
    addActivity,
    resetDemo,
    formatDuration,
    leaderboard,
    segmentEfforts,
    seedActivities,
    seedChallenges
  };
})(window);
