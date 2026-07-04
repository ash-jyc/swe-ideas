// FIXTURE — intentionally vulnerable XSS sinks.
import React from 'react';

export function renderBioCard(user) {
  const card = document.getElementById('bio-card');
  card.innerHTML = `<h2>${user.name}</h2><p>${user.bio}</p>`;
}

export function About({ user }) {
  return <div dangerouslySetInnerHTML={{ __html: user.aboutHtml }} />;
}
