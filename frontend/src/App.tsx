import '@/App.css'

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import { ThemeProvider, CssBaseline, createTheme } from "@mui/material";
import { Routes, Route, BrowserRouter } from "react-router-dom";

import NotFoundPage from '@/components/pages/404';
import ScrollToTop from '@/components/layout/ScrollToTop';
import HomePage from '@/components/pages/home';
import { ContractAnalysisProvider } from '@/components/layout/ContractAnalysisContext';

const theme = createTheme({
    palette: {
        mode: "dark",
    },
});

export default function App() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <ContractAnalysisProvider>
                <BrowserRouter>
                    <ScrollToTop />
                    <Routes>
                        <Route path="/" element={<HomePage />} />

                        {/* Catch-all 404 Route - MUST REMAIN AT BOTTOM */}
                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                </BrowserRouter>
            </ContractAnalysisProvider>
        </ThemeProvider>
    );
}
