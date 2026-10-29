/* Community feed, composer, and post interactions. */
(function () {
  const section = document.getElementById('community');
  const list = document.getElementById('postList');
  if (!section || !list) return;

  const LOCAL_KEY = 'vyora_community_local_posts';
  const VOTES_KEY = 'vyora_community_votes';
  const SAVED_KEY = 'vyora_community_saved_posts';
  const status = document.getElementById('postStatus');
  const createStatus = document.getElementById('postCreateStatus');
  const previewNotice = document.getElementById('communityPreviewNotice');
  const previewEnabled = document.querySelector('meta[name="vyora-community-preview"]')?.content === 'true';
  const form = document.getElementById('communityPostForm');
  const publishButton = document.getElementById('postPublish');
  const filters = section.querySelectorAll('[data-post-filter]');
  const topicFilter = document.getElementById('communityTopicFilter');
  const topicRules = [
    { value: 'training', label: 'Training', terms: /\b(training|workout|strength|gym|running|run|marathon|lifting|exercise)\b/i },
    { value: 'nutrition', label: 'Nutrition', terms: /\b(nutrition|food|protein|meal|fuel|recipe|hydration)\b/i },
    { value: 'progress', label: 'Progress', terms: /\b(progress|milestone|personal record|pr|journey|improvement|goal)\b/i },
    { value: 'recovery', label: 'Recovery', terms: /\b(recovery|recover|rest|mobility|yoga|stretch|sleep)\b/i }
  ];
  let activeFilter = 'all';
  let activeTopic = 'all';
  let sortMode = 'newest';
  let posts = [];
  let me = null;
  let loadId = 0;

  const imageDescriptions = {
    '/assets/community/02_strength_training.jpg': 'Athlete performing a strength-training exercise.',
    '/assets/community/03_running_outdoor.jpg': 'Runner training beside the water at sunset.',
    '/assets/community/04_meal_prep.jpg': 'Balanced meal prepared for training.',
    '/assets/community/05_yoga_recovery.jpg': 'Athlete stretching during a recovery session.',
    '/assets/community/06_gym_motivation.jpg': 'Gym equipment and a VYORA training bottle.',
    '/assets/community/07_progress_journey.jpg': 'Hiker looking across a mountain range at sunrise.',
    '/assets/community/08_recovery_motivation.jpg': 'Yoga mat and bottle set out for a recovery session.',
    '/assets/community/09_discipline_motivation.jpg': 'Athlete preparing for a strength session.',
    '/assets/community/10_mindset_wellness.jpg': 'Athlete taking a quiet moment in the mountains.'
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function setStatus(message, target) {
    const output = target || status;
    if (output) output.textContent = message;
  }

  function errorMessage(error, fallback) {
    if (error instanceof TypeError || error.message === 'Failed to fetch') return fallback;
    return error.message || fallback;
  }

  function readStored(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value === null ? fallback : value;
    } catch (error) {
      setStatus('Some saved Community data could not be read. You can still browse posts.');
      return fallback;
    }
  }

  function writeStored(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      setStatus('This change could not be saved on this device.');
      return false;
    }
  }

  function localPosts() {
    const saved = readStored(LOCAL_KEY, []);
    return Array.isArray(saved) ? saved : [];
  }

  function votesMap() {
    const saved = readStored(VOTES_KEY, {});
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  }

  function savedPosts() {
    const saved = readStored(SAVED_KEY, []);
    return new Set(Array.isArray(saved) ? saved : []);
  }

  function isLocalPost(post) {
    return String(post.id).startsWith('local_');
  }

  function isDemoPost(post) {
    return post.demoPreview === true;
  }

  function demoPreviewPosts() {
    const now = Date.now();
    return [
      {
        id: 'demo_strength',
        author: 'VYORA preview',
        type: 'article',
        title: 'Build the lift before the load',
        body: 'Preview example: keep each rep controlled and add weight only when your form stays consistent.\n\n#training #strength #form',
        mediaUrl: '/assets/community/02_strength_training.jpg',
        createdAt: new Date(now - 86400000).toISOString()
      },
      {
        id: 'demo_running',
        author: 'VYORA preview',
        type: 'photo',
        title: 'Find a pace you can repeat',
        body: 'Preview example: easy runs should leave enough room to recover and return for the next session.\n\n#training #running #endurance',
        mediaUrl: '/assets/community/03_running_outdoor.jpg',
        createdAt: new Date(now - 2 * 86400000).toISOString()
      },
      {
        id: 'demo_nutrition',
        author: 'VYORA preview',
        type: 'blog',
        title: 'Make the next meal easier',
        body: 'Preview example: prepare a protein source and a carbohydrate option ahead of a busy training day.\n\n#nutrition #mealprep #fuel',
        mediaUrl: '/assets/community/04_meal_prep.jpg',
        createdAt: new Date(now - 3 * 86400000).toISOString()
      },
      {
        id: 'demo_progress',
        author: 'VYORA preview',
        type: 'article',
        title: 'Track one useful milestone',
        body: 'Preview example: note the load, distance, or time alongside how the session felt.\n\n#progress #consistency #goals',
        mediaUrl: '/assets/community/07_progress_journey.jpg',
        createdAt: new Date(now - 4 * 86400000).toISOString()
      },
      {
        id: 'demo_recovery',
        author: 'VYORA preview',
        type: 'photo',
        title: 'Give mobility a place in the plan',
        body: 'Preview example: a short, comfortable stretch session can support recovery days.\n\n#recovery #mobility #stretching',
        mediaUrl: '/assets/community/05_yoga_recovery.jpg',
        createdAt: new Date(now - 5 * 86400000).toISOString()
      },
      {
        id: 'demo_motivation',
        author: 'VYORA preview',
        type: 'blog',
        title: 'Consistency beats the perfect week',
        body: 'Preview example: a short session still counts toward building a sustainable routine.\n\n#progress #motivation #habits',
        mediaUrl: '/assets/community/06_gym_motivation.jpg',
        createdAt: new Date(now - 6 * 86400000).toISOString()
      }
    ].map((post) => normalizePost({ ...post, comments: 0, likes: 0, demoPreview: true }));
  }

  function isSavedMediaUrl(value) {
    if (typeof value !== 'string') return false;
    if (Object.prototype.hasOwnProperty.call(imageDescriptions, value)) return true;
    if (!/^https:\/\//i.test(value)) return false;
    try {
      return new URL(value).protocol === 'https:';
    } catch (error) {
      return false;
    }
  }

  function normalizePost(post) {
    return {
      ...post,
      authorName: String(post.authorName || post.author || 'VYORA member'),
      type: ['article', 'blog', 'video', 'reel', 'photo'].includes(post.type) ? post.type : 'article',
      likes: Number.isFinite(Number(post.likes)) ? Number(post.likes) : 0,
      comments: Number.isFinite(Number(post.comments)) ? Number(post.comments) : 0,
      liked: Boolean(post.liked),
      mediaUrl: isSavedMediaUrl(post.mediaUrl) ? post.mediaUrl : ''
    };
  }

  function timeAgo(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Recently';
    const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function typeLabel(type) {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  function postTags(post) {
    const matches = `${post.title || ''} ${post.body || ''}`.match(/#[a-z0-9_]+/gi) || [];
    return Array.from(new Set(matches.map((tag) => tag.toLowerCase())));
  }

  function postTopic(post) {
    const tags = postTags(post);
    const taggedTopic = topicRules.find((topic) => tags.includes(`#${topic.value}`));
    if (taggedTopic) return taggedTopic.value;
    const text = `${post.title || ''} ${post.body || ''}`;
    const detectedTopic = topicRules.find((topic) => topic.terms.test(text));
    return detectedTopic ? detectedTopic.value : '';
  }

  function postDescription(post) {
    return String(post.body || '').replace(/(?:^|\n)\s*(?:#[a-z0-9_]+\s*)+(?=\n|$)/gi, '').trim();
  }

  function updateLocalPost(post) {
    const current = localPosts();
    const next = current.map((item) => item.id === post.id ? post : item);
    writeStored(LOCAL_KEY, next);
  }

  function renderComment(comment, fallbackAuthor) {
    const row = el('div', 'com-comment-row');
    row.appendChild(el('strong', '', comment.author || fallbackAuthor || 'VYORA member'));
    row.appendChild(el('span', '', comment.body || ''));
    return row;
  }

  function renderComments(root, comments) {
    root.replaceChildren();
    if (!comments.length) {
      root.appendChild(el('p', 'com-no-comments', 'No comments yet. Start the conversation.'));
      return;
    }
    comments.forEach((comment) => root.appendChild(renderComment(comment)));
  }

  function addPostImage(card, post) {
    if (!post.mediaUrl) return;
    const figure = el('figure', 'com-post-media');
    if (post.type === 'video' || post.type === 'reel') {
      let isPlayableFile = false;
      try {
        isPlayableFile = /\.(mp4|m4v|webm|ogv)$/i.test(new URL(post.mediaUrl).pathname);
      } catch (error) {
        isPlayableFile = false;
      }
      if (isPlayableFile) {
        const video = document.createElement('video');
        video.controls = true;
        video.preload = 'metadata';
        video.setAttribute('aria-label', post.title ? `Video: ${post.title}` : 'Community video');
        video.src = post.mediaUrl;
        figure.appendChild(video);
      } else {
        const link = el('a', 'com-media-link', post.type === 'reel' ? 'Open shared reel' : 'Open shared video');
        link.href = post.mediaUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        figure.appendChild(link);
      }
      card.appendChild(figure);
      return;
    }
    const image = document.createElement('img');
    image.src = post.mediaUrl;
    image.alt = imageDescriptions[post.mediaUrl] || `Image shared with ${post.title || 'this post'}.`;
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => {
      figure.replaceChildren();
      const link = el('a', 'com-media-link', 'Open shared media');
      link.href = post.mediaUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      figure.appendChild(link);
    }, { once: true });
    figure.appendChild(image);
    card.appendChild(figure);
  }

  function postCard(post) {
    const card = el('article', 'com-post');
    card.id = `community-post-${encodeURIComponent(String(post.id))}`;
    const head = el('div', 'com-post-head');
    const avatar = el('div', 'com-avatar', post.authorName.trim().charAt(0).toUpperCase() || 'V');
    avatar.setAttribute('aria-hidden', 'true');
    const meta = el('div', 'com-post-meta');
    meta.appendChild(el('strong', '', post.authorName));
    const sub = el('div', 'com-post-sub');
    sub.appendChild(el('time', '', isDemoPost(post) ? `Preview, ${timeAgo(post.createdAt)}` : timeAgo(post.createdAt)));
    sub.appendChild(el('span', 'com-post-type', typeLabel(post.type)));
    if (isDemoPost(post)) sub.appendChild(el('span', 'com-preview-label', 'Preview'));
    meta.appendChild(sub);
    head.append(avatar, meta);

    const menu = document.createElement('details');
    menu.className = 'com-more-menu';
    const menuToggle = el('summary', '', 'More');
    menuToggle.setAttribute('aria-label', `More options for ${post.title || 'post'}`);
    menu.appendChild(menuToggle);
    const menuItems = el('div', 'com-menu-items');
    if (isDemoPost(post)) {
      menuItems.appendChild(el('span', '', 'Preview examples cannot be reported or deleted.'));
    } else if (isLocalPost(post) || (me && post.userId && String(post.userId) === String(me.id))) {
      const remove = el('button', '', 'Delete post');
      remove.type = 'button';
      remove.addEventListener('click', async () => {
        if (!window.confirm('Delete this post? This cannot be undone.')) return;
        try {
          if (isLocalPost(post)) {
            writeStored(LOCAL_KEY, localPosts().filter((item) => item.id !== post.id));
          } else {
            await VyoraAPI.deletePost(post.id);
          }
          menu.open = false;
          await loadFeed();
          setStatus('Post deleted.');
        } catch (error) {
          setStatus(errorMessage(error, 'The post could not be deleted.'));
        }
      });
      menuItems.appendChild(remove);
    } else if (!isLocalPost(post)) {
      const report = el('button', '', 'Report post');
      report.type = 'button';
      report.addEventListener('click', async () => {
        try {
          await VyoraAPI.reportPost(post.id, 'Community guideline concern', '');
          menu.open = false;
          setStatus('Report sent to the moderation team.');
        } catch (error) {
          setStatus(errorMessage(error, 'The post could not be reported.'));
        }
      });
      menuItems.appendChild(report);
    }
    if (!menuItems.childElementCount) {
      const shareHint = el('span', '', 'Use Share to pass this post along.');
      menuItems.appendChild(shareHint);
    }
    menu.appendChild(menuItems);
    head.appendChild(menu);
    card.appendChild(head);

    card.appendChild(el('h2', 'com-post-title', post.title || 'Community post'));
    const description = postDescription(post);
    if (description) card.appendChild(el('p', 'com-post-body', description));
    const tags = postTags(post);
    if (tags.length) {
      const tagList = el('div', 'com-post-tags');
      tags.forEach((tag) => tagList.appendChild(el('span', 'com-post-tag', tag)));
      card.appendChild(tagList);
    }
    addPostImage(card, post);

    const localVotes = votesMap();
    const liked = isDemoPost(post)
      ? Boolean(post.demoLiked)
      : isLocalPost(post) ? localVotes[post.id] === 'up' || localVotes[post.id] === true : post.liked;
    const likeCount = Math.max(0, post.likes + ((isLocalPost(post) || isDemoPost(post)) && liked ? 1 : 0));
    const actions = el('div', 'com-post-actions');
    const like = el('button', `com-action-btn${liked ? ' is-active' : ''}`, `${liked ? '♥' : '♡'} Like  ${likeCount}`);
    like.type = 'button';
    like.setAttribute('aria-label', `${liked ? 'Unlike' : 'Like'} post. ${likeCount} likes.`);
    like.setAttribute('aria-pressed', String(liked));
    like.addEventListener('click', async () => {
      try {
        if (isDemoPost(post)) {
          post.demoLiked = !post.demoLiked;
          renderFeed();
        } else if (isLocalPost(post)) {
          const next = votesMap();
          if (next[post.id] === 'up' || next[post.id] === true) delete next[post.id];
          else next[post.id] = 'up';
          if (!writeStored(VOTES_KEY, next)) return;
          renderFeed();
        } else {
          await VyoraAPI.likePost(post.id);
          await loadFeed();
        }
      } catch (error) {
        setStatus(errorMessage(error, 'Your like could not be saved.'));
      }
    });

    const commentButton = el('button', 'com-action-btn', `Comments  ${post.comments}`);
    commentButton.type = 'button';
    commentButton.setAttribute('aria-expanded', 'false');
    const commentPanel = el('div', 'com-comment-panel');
    commentPanel.hidden = true;
    const comments = el('div', 'com-comment-list');
    const commentForm = document.createElement('form');
    commentForm.className = 'com-comment-form';
    const commentInput = document.createElement('input');
    commentInput.type = 'text';
    commentInput.name = 'comment';
    commentInput.maxLength = 1500;
    commentInput.setAttribute('aria-label', 'Write a comment');
    commentInput.placeholder = 'Add a thoughtful comment';
    commentInput.required = true;
    const sendComment = el('button', 'com-comment-submit', 'Post');
    sendComment.type = 'submit';
    commentForm.append(commentInput, sendComment);
    commentPanel.append(comments, commentForm);
    let commentsLoaded = false;
    commentButton.addEventListener('click', async () => {
      commentPanel.hidden = !commentPanel.hidden;
      commentButton.setAttribute('aria-expanded', String(!commentPanel.hidden));
      if (commentPanel.hidden || commentsLoaded) return;
      if (isLocalPost(post) || isDemoPost(post)) {
        renderComments(comments, Array.isArray(post.localComments) ? post.localComments : []);
        commentsLoaded = true;
        return;
      }
      try {
        const result = await VyoraAPI.listComments(post.id);
        renderComments(comments, Array.isArray(result) ? result : []);
        commentsLoaded = true;
      } catch (error) {
        comments.appendChild(el('p', 'com-inline-error', errorMessage(error, 'Comments could not be loaded.')));
      }
    });
    commentForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = commentInput.value.trim();
      if (!body) return;
      sendComment.disabled = true;
      try {
        if (isLocalPost(post) || isDemoPost(post)) {
          post.localComments = Array.isArray(post.localComments) ? post.localComments : [];
          post.localComments.push({ author: me && (me.displayName || me.name) || 'You', body });
          post.comments += 1;
          if (isLocalPost(post)) updateLocalPost(post);
          renderComments(comments, post.localComments);
          commentsLoaded = true;
          commentButton.textContent = `Comments  ${post.comments}`;
        } else {
          const result = await VyoraAPI.commentPost(post.id, body);
          commentInput.value = '';
          comments.appendChild(renderComment({
            author: me && (me.displayName || me.name) || 'You',
            body: result.body || body
          }));
          commentsLoaded = true;
          post.comments += 1;
          commentButton.textContent = `Comments  ${post.comments}`;
        }
        commentInput.value = '';
      } catch (error) {
        comments.appendChild(el('p', 'com-inline-error', errorMessage(error, 'Your comment could not be posted.')));
      } finally {
        sendComment.disabled = false;
      }
    });
    actions.append(like, commentButton);

    const saved = savedPosts();
    const save = el('button', `com-action-btn${saved.has(post.id) ? ' is-active' : ''}`, saved.has(post.id) ? 'Saved' : 'Save');
    save.type = 'button';
    save.setAttribute('aria-pressed', String(saved.has(post.id)));
    save.addEventListener('click', () => {
      const next = savedPosts();
      if (next.has(post.id)) next.delete(post.id);
      else next.add(post.id);
      if (!writeStored(SAVED_KEY, Array.from(next))) return;
      save.textContent = next.has(post.id) ? 'Saved' : 'Save';
      save.classList.toggle('is-active', next.has(post.id));
      save.setAttribute('aria-pressed', String(next.has(post.id)));
      setStatus(next.has(post.id) ? 'Post saved on this device.' : 'Post removed from saved items.');
    });
    actions.appendChild(save);

    const share = el('button', 'com-action-btn', 'Share');
    share.type = 'button';
    share.addEventListener('click', async () => {
      const postUrl = `${window.location.origin}${window.location.pathname}#${card.id}`;
      const text = `${post.title || 'Community post'}\n${postUrl}`;
      try {
        if (navigator.share) await navigator.share({ title: post.title || 'VYORA Community', text, url: postUrl });
        else if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          setStatus('Post link copied.');
        } else {
          throw new Error('Sharing is not available in this browser.');
        }
      } catch (error) {
        if (error.name !== 'AbortError') setStatus(error.message || 'The post could not be shared.');
      }
    });
    actions.appendChild(share);
    card.append(actions, commentPanel);
    return card;
  }

  function renderLoading() {
    list.replaceChildren();
    list.setAttribute('aria-busy', 'true');
    for (let index = 0; index < 4; index += 1) {
      const skeleton = el('div', 'com-skeleton');
      skeleton.setAttribute('aria-hidden', 'true');
      skeleton.append(el('span', 'com-skeleton-line short'), el('span', 'com-skeleton-line'), el('span', 'com-skeleton-line medium'), el('span', 'com-skeleton-image'));
      list.appendChild(skeleton);
    }
  }

  function renderFeed() {
    const query = (document.getElementById('communitySearch').value || '').trim().toLowerCase();
    const visiblePosts = posts.filter((post) => {
      if (activeFilter !== 'all' && post.type !== activeFilter) return false;
      if (activeTopic !== 'all' && postTopic(post) !== activeTopic) return false;
      const haystack = `${post.title || ''} ${post.body || ''} ${post.authorName || ''} ${post.type || ''} ${postTags(post).join(' ')}`.toLowerCase();
      return !query || haystack.includes(query);
    });
    visiblePosts.sort((a, b) => sortMode === 'popular'
      ? getLikeCount(b) - getLikeCount(a) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      : new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    list.replaceChildren();
    list.setAttribute('aria-busy', 'false');
    if (!visiblePosts.length) {
      const empty = el('div', 'com-empty');
      empty.appendChild(el('h2', '', posts.length ? 'No posts match this view.' : 'The feed is ready for its first post.'));
      empty.appendChild(el('p', '', posts.length ? 'Try another filter or search term.' : 'Share a training note or idea to get the conversation started.'));
      if (!posts.length) {
        const write = el('button', 'com-secondary-btn', 'Write a post');
        write.type = 'button';
        write.addEventListener('click', () => {
          document.getElementById('communityComposer').open = true;
          document.getElementById('postTitle').focus();
        });
        empty.appendChild(write);
      }
      if (posts.length && (activeFilter !== 'all' || activeTopic !== 'all' || query)) {
        const clear = el('button', 'com-secondary-btn', 'Clear filters');
        clear.type = 'button';
        clear.addEventListener('click', () => {
          activeFilter = 'all';
          activeTopic = 'all';
          topicFilter.value = 'all';
          document.getElementById('communitySearch').value = '';
          filters.forEach((button) => {
            const active = button.dataset.postFilter === 'all';
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
          });
          renderFeed();
        });
        empty.appendChild(clear);
      }
      list.appendChild(empty);
      return;
    }
    visiblePosts.forEach((post) => list.appendChild(postCard(post)));
  }

  function scrollToSharedPost() {
    const sharedPostPrefix = '#community-post-';
    if (!window.location.hash.startsWith(sharedPostPrefix)) return;
    window.VyoraNavigation && window.VyoraNavigation.go('community');
    const post = document.getElementById(window.location.hash.slice(1));
    if (post) post.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function getLikeCount(post) {
    const likedLocally = isDemoPost(post)
      ? Boolean(post.demoLiked)
      : isLocalPost(post) && (votesMap()[post.id] === 'up' || votesMap()[post.id] === true);
    return post.likes + (likedLocally ? 1 : 0);
  }

  function renderHighlights() {
    const topicList = document.getElementById('communityTopics');
    const exploreList = document.getElementById('communityExploreTopics');
    const hasPreviewPosts = posts.some(isDemoPost);
    const trendingHeading = topicList.closest('.com-rail-section')?.querySelector('h2');
    if (trendingHeading) trendingHeading.textContent = hasPreviewPosts ? 'Topics in preview' : 'Trending topics';
    topicList.replaceChildren();
    exploreList.replaceChildren();

    const topics = topicRules.map((topic) => ({
      ...topic,
      count: posts.filter((post) => postTopic(post) === topic.value).length
    })).filter((topic) => topic.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);
    if (!topics.length) {
      topicList.appendChild(el('p', 'com-rail-empty', 'Topics will appear as members share posts.'));
    } else {
      topics.forEach((topic) => {
        topicList.appendChild(topicButton(topic, !hasPreviewPosts));
      });
    }

    topicRules.forEach((topic) => {
      exploreList.appendChild(topicButton(topic, false));
    });
  }

  function topicButton(topic, showCount) {
    const button = el('button', 'com-topic', topic.label);
    button.type = 'button';
    if (showCount) button.appendChild(el('span', '', `${topic.count} ${topic.count === 1 ? 'post' : 'posts'}`));
    button.addEventListener('click', () => {
      activeTopic = topic.value;
      topicFilter.value = topic.value;
      renderFeed();
      list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return button;
  }

  async function loadFeed() {
    const requestId = ++loadId;
    renderLoading();
    setStatus('');
    if (previewNotice) previewNotice.hidden = true;
    const results = await Promise.allSettled([VyoraAPI.me(), VyoraAPI.listPosts()]);
    if (requestId !== loadId) return;
    const userResult = results[0];
    const feedResult = results[1];
    me = userResult.status === 'fulfilled' ? userResult.value : null;
    if (feedResult.status === 'rejected') {
      if (previewNotice) previewNotice.hidden = true;
      posts = localPosts().filter((post) => post && post.id).map(normalizePost);
      if (posts.length) {
        renderFeed();
        renderHighlights();
        scrollToSharedPost();
      } else {
        list.replaceChildren();
        list.setAttribute('aria-busy', 'false');
      }
      const error = el('div', 'com-empty com-error');
      error.appendChild(el('h2', '', posts.length ? 'Showing posts saved on this device.' : 'Community posts could not be loaded.'));
      error.appendChild(el('p', '', errorMessage(feedResult.reason, 'We could not reach the Community service. Check your connection and try again.')));
      const retry = el('button', 'com-secondary-btn', 'Try again');
      retry.type = 'button';
      retry.addEventListener('click', loadFeed);
      error.appendChild(retry);
      if (posts.length) list.prepend(error);
      else list.appendChild(error);
      setStatus(errorMessage(feedResult.reason, 'Community posts could not be loaded.'));
      return;
    }
    if (!userResult || userResult.status === 'rejected') {
      setStatus('Your profile could not be loaded. Some account actions may be unavailable.');
    }
    if (!Array.isArray(feedResult.value)) {
      if (previewNotice) previewNotice.hidden = true;
      list.replaceChildren();
      list.setAttribute('aria-busy', 'false');
      setStatus('The Community response was not in the expected format.');
      return;
    }
    const combined = localPosts().concat(feedResult.value.filter((post) => post && typeof post === 'object')).map(normalizePost);
    const seen = new Set();
    posts = combined.filter((post) => {
      if (!post || !post.id || seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });
    if (!posts.length && previewEnabled) posts = demoPreviewPosts();
    if (previewNotice) previewNotice.hidden = !posts.some(isDemoPost);
    renderFeed();
    renderHighlights();
    scrollToSharedPost();
  }

  filters.forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.postFilter || 'all';
      filters.forEach((filter) => {
        const active = filter === button;
        filter.classList.toggle('active', active);
        filter.setAttribute('aria-pressed', String(active));
      });
      renderFeed();
    });
  });

  document.getElementById('communitySearch').addEventListener('input', renderFeed);
  document.getElementById('communitySort').addEventListener('change', (event) => {
    sortMode = event.target.value;
    renderFeed();
  });
  topicFilter.addEventListener('change', (event) => {
    activeTopic = event.target.value;
    renderFeed();
  });

  const postAsset = document.getElementById('postAsset');
  const postMedia = document.getElementById('postMedia');
  const imagePreview = document.getElementById('postImagePreview');
  function updateImagePreview() {
    const source = postMedia.value.trim() || postAsset.value;
    if (!source || (postMedia.value.trim() && !/^https:\/\//i.test(source))) {
      imagePreview.hidden = true;
      imagePreview.removeAttribute('src');
      return;
    }
    imagePreview.src = source;
    imagePreview.alt = postAsset.value
      ? `Preview: ${postAsset.options[postAsset.selectedIndex].text}`
      : 'Preview of the linked image';
    imagePreview.hidden = false;
  }
  postAsset.addEventListener('change', updateImagePreview);
  postMedia.addEventListener('input', updateImagePreview);

  document.getElementById('postCancel').addEventListener('click', () => {
    form.reset();
    imagePreview.hidden = true;
    imagePreview.removeAttribute('src');
    document.getElementById('communityComposer').open = false;
    setStatus('', createStatus);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const title = document.getElementById('postTitle').value.trim();
    const body = document.getElementById('postBody').value.trim();
    const type = document.getElementById('postType').value;
    const topic = document.getElementById('postTopic').value;
    const rawTags = document.getElementById('postHashtags').value.trim();
    const asset = document.getElementById('postAsset').value;
    const externalMedia = document.getElementById('postMedia').value.trim();
    let mediaUrl = asset;
    if (!title || !body) {
      setStatus('Add a title and description before publishing.', createStatus);
      return;
    }
    const hashtags = rawTags
      .split(/[,\s]+/)
      .map((tag) => tag.replace(/^#+/, '').toLowerCase())
      .filter(Boolean);
    if (hashtags.length > 5 || hashtags.some((tag) => !/^[a-z0-9_]{1,30}$/.test(tag))) {
      setStatus('Use up to five hashtags with letters, numbers, or underscores.', createStatus);
      return;
    }
    const postBody = [body, ...Array.from(new Set([topic, ...hashtags]), (tag) => `#${tag}`)].join('\n\n');
    if (postBody.length > 5000) {
      setStatus('Your post is too long once its topic and hashtags are added.', createStatus);
      return;
    }
    if (externalMedia) {
      try {
        const parsed = new URL(externalMedia);
        if (parsed.protocol !== 'https:') throw new Error('Media links must use HTTPS.');
        mediaUrl = parsed.href;
      } catch (error) {
        setStatus(error.message || 'Enter a valid HTTPS media link.', createStatus);
        return;
      }
    }
    publishButton.disabled = true;
    setStatus('Publishing your post...', createStatus);
    try {
      const created = await VyoraAPI.createPost({ title, body: postBody, type, mediaUrl });
      if (!created || !created.id) throw new Error('The server did not confirm that your post was published.');
      posts = [normalizePost(created), ...posts.filter((post) => !isDemoPost(post) && post.id !== created.id)];
      if (previewNotice) previewNotice.hidden = true;
      setStatus('Your post has been published.', createStatus);
      form.reset();
      imagePreview.hidden = true;
      imagePreview.removeAttribute('src');
      document.getElementById('communityComposer').open = false;
      renderFeed();
      renderHighlights();
    } catch (error) {
      setStatus(errorMessage(error, 'Your post could not be published. Your draft is still here.'), createStatus);
    } finally {
      publishButton.disabled = false;
    }
  });

  loadFeed();
})();
