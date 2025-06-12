import { getProfile } from "@/lib/actions";


const ProfilePage = async () => {
  const profile = await getProfile();


  return <div>
    <p>ProfilePage</p>
      <pre>{JSON.stringify(profile)}</pre>
    </div>;
};

export default ProfilePage;