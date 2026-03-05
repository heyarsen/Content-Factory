import { FC } from 'react';

const AiSmmAgentPage: FC = () => {
  return (
    <div style={{ width: '100%', height: 'calc(100vh - 64px)', border: 'none' }}>
      <iframe
        src="https://ai-smm.co/ai-smm-agent.html"
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="AI SMM Agent"
      ></iframe>
    </div>
  );
};

export default AiSmmAgentPage;
