import { useState } from 'react';
import './App.scss';
import Board from './components/board/board.tsx';
import { ProjectSelector } from './components/project/ProjectSelector.tsx';

function App() {
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
		null,
	);

	if (!selectedProjectId) {
		return (
			<ProjectSelector
				onSelectProject={(project) => setSelectedProjectId(project.id)}
			/>
		);
	}

	return (
		<Board
			projectId={selectedProjectId}
			onBackToProjects={() => setSelectedProjectId(null)}
		/>
	);
}

export default App;
