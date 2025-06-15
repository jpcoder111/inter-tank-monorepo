import SignInForm from "./signinForm";
import Image from "next/image";
import InterTankLogo from "@/public/intertank.jpeg";

const SignInPage = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-8 h-full">
      <Image
        src={InterTankLogo}
        alt="Intertank"
        width={220}
        height={220}
        className="rounded-3xl shadow-md"
      />

      <div className="bg-white p-8 rounded-md shadow-md">
        <SignInForm />
      </div>
    </div>
  );
};

export default SignInPage;
