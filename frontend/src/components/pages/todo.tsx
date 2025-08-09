import { useState } from 'react'
import { Box, Typography, Button } from '@mui/material';

export default function TodoPage() {
    const [count, setCount] = useState(0);

    return (
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh">
            <Typography variant="h3" gutterBottom>Vite + React + Material UI</Typography>
            <Box className="card" mb={2} display="flex" flexDirection="column" alignItems="center">
                <Button variant="contained" onClick={() => setCount((count) => count + 1)}>
                    count is {count}
                </Button>
                <Typography variant="body1" mt={2}>
                    Edit <code>src/App.tsx</code> and save to test HMR
                </Typography>
            </Box>
            <Typography className="read-the-docs" color="textSecondary">
                Click on the Vite and React logos to learn more
            </Typography>
        </Box>
    );
}
