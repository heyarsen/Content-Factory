Subject: Motion Not Working in Template API Generation

Hi HeyGen Support,

We're using the Template API (`POST /v2/template/{template_id}/generate`) with photo avatars. Our template has "Full body motion" enabled in the UI, but API-generated videos only show lip-sync with no head movement or gestures.

**Questions:**
1. How do we enable motion when generating from templates via API? Should motion be inherited from template settings, or do we need to set it explicitly in `nodes_override`?
2. Can photo avatars (talking_photo) support full body motion in templates, or are they limited to head movement?
3. We tried using the Add Motion API (`/v2/photo_avatar/add_motion`) but the returned ID causes 500 errors in template generation. Should we use this API differently?

**Current Request:**
We're setting `custom_motion_prompt` and `enhance_custom_motion_prompt` in `nodes_override`, but motion still doesn't work.

Could you provide the correct way to enable motion in template-based generation?

Thanks,
[Your Name]
[Your Email]

