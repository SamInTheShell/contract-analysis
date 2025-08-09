import { Box, Typography, Paper } from '@mui/material';

export default function NotFoundPage() {
    return (
        <Box sx={{
            minHeight: '100vh',
            position: 'relative',
            background: 'linear-gradient(120deg, #e0eafc 0%, #cfdef3 100%)',
            overflow: 'hidden',
        }}>
            {/* Blurred accent background */}
            <Box sx={{
                position: 'absolute',
                top: { xs: 40, md: 80 },
                left: { xs: -80, md: 0 },
                right: { xs: -80, md: 0 },
                mx: 'auto',
                width: { xs: '90%', md: 700 },
                height: { xs: 220, md: 320 },
                background: 'linear-gradient(135deg, #a7bfe8 0%, #f3e7e9 100%)',
                filter: 'blur(48px)',
                opacity: 0.5,
                zIndex: 0,
                borderRadius: 6,
            }} />
            <Box sx={{
                position: 'relative',
                zIndex: 1,
                maxWidth: { xs: '100%', sm: 600, md: 900 },
                mx: 'auto',
                p: { xs: 2, sm: 3, md: 4 },
                display: 'flex',
                flexDirection: 'column',
                gap: { xs: 2, sm: 3, md: 4 },
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '80vh',
            }}>
                <Typography variant="h2" align="center" sx={{ fontWeight: 700, mb: 2, color: '#2a3659', letterSpacing: 1 }}>
                    404 - Page Not Found
                </Typography>
                <Paper elevation={8} sx={{
                    p: 3,
                    borderRadius: 4,
                    background: 'rgba(255,255,255,0.92)',
                    boxShadow: '0 8px 32px 0 rgba(60,60,120,0.12)',
                    maxWidth: 480,
                    textAlign: 'center',
                }}>
                    <Typography variant="body1" sx={{ color: '#3a3a3a', fontWeight: 500 }}>
                        Sorry, the page you are looking for does not exist.
                    </Typography>
                </Paper>
            </Box>
        </Box>
    );
}
